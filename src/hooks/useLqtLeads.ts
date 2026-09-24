import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVertical } from '@/contexts/VerticalContext';
import type { Database } from '@/integrations/supabase/types';

type LeadSource = Database['public']['Enums']['lead_source'];

export interface LqtLead {
  id: string;
  title: string;
  source: LeadSource;
  source_reference: string | null;
  customer_query: string | null;
  created_at: string;
  assigned_to: string | null;
  customer_id: string | null;
  suggested_assignee_id: string | null;
  suggested_assignee: { id: string; full_name: string | null } | null;
  customer: {
    id: string;
    company_name: string;
    contact_person: string | null;
    phone: string;
    email: string | null;
    city: string | null;
    state: string | null;
  } | null;
  qualification: {
    id: string;
    qualification_type: 'simple' | 'technical' | 'invalid';
    routed_to: 'spt' | 'tst' | 'discard' | 'nurture';
    qualified_at: string;
    decision_reason: string | null;
  } | null;
}

export type LqtTab = 'pending' | 'nurture' | 'qualified' | 'discarded';

export type LqtRangePreset = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom';

export interface LqtRange {
  preset: LqtRangePreset;
  from?: Date;
  to?: Date;
}

export function resolveRange(range: LqtRange): { from: Date | null; to: Date | null; label: string } {
  const now = new Date();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  switch (range.preset) {
    case 'today':
      return { from: startOfToday, to: now, label: 'today' };
    case '7d':
      return { from: new Date(Date.now() - 7 * 86400000), to: now, label: 'last 7 days' };
    case '30d':
      return { from: new Date(Date.now() - 30 * 86400000), to: now, label: 'last 30 days' };
    case '90d':
      return { from: new Date(Date.now() - 90 * 86400000), to: now, label: 'last 90 days' };
    case 'all':
      return { from: null, to: null, label: 'all time' };
    case 'custom': {
      const from = range.from ?? null;
      const to = range.to ?? now;
      return { from, to, label: 'custom range' };
    }
  }
}

const DEFAULT_RANGE: LqtRange = { preset: '30d' };

// ---------------------------------------------------------------------------
// Lightweight composer: avoid PostgREST embeds (which were timing out under
// the current visibility rules). Fetch leads + customers + qualifications
// in narrow, indexed queries and stitch them together client-side.
// ---------------------------------------------------------------------------

interface LeadRow {
  id: string;
  title: string;
  source: LeadSource;
  source_reference: string | null;
  customer_query: string | null;
  created_at: string;
  assigned_to: string | null;
  customer_id: string | null;
  suggested_assignee_id: string | null;
}

interface CustomerRow {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  state: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
}

interface QualRow {
  id: string;
  lead_id: string;
  qualification_type: 'simple' | 'technical' | 'invalid';
  routed_to: 'spt' | 'tst' | 'discard' | 'nurture';
  qualified_at: string;
  decision_reason: string | null;
}

const LEAD_FIELDS =
  'id, title, source, source_reference, customer_query, created_at, assigned_to, customer_id, suggested_assignee_id';

async function fetchLeadsByIds(ids: string[]): Promise<LeadRow[]> {
  if (ids.length === 0) return [];
  // Chunk to avoid huge IN() URLs
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
  const results: LeadRow[] = [];
  for (const c of chunks) {
    const { data, error } = await supabase
      .from('leads')
      .select(LEAD_FIELDS)
      .is('deleted_at', null)
      .in('id', c);
    if (error) throw error;
    results.push(...((data ?? []) as LeadRow[]));
  }
  return results;
}

async function fetchCustomersByIds(ids: string[]): Promise<Map<string, CustomerRow>> {
  const map = new Map<string, CustomerRow>();
  if (ids.length === 0) return map;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
  for (const c of chunks) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, company_name, contact_person, phone, email, city, state')
      .in('id', c);
    if (error) throw error;
    for (const row of (data ?? []) as CustomerRow[]) map.set(row.id, row);
  }
  return map;
}

async function fetchProfilesByIds(ids: string[]): Promise<Map<string, ProfileRow>> {
  const map = new Map<string, ProfileRow>();
  if (ids.length === 0) return map;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
  for (const c of chunks) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', c);
    if (error) throw error;
    for (const row of (data ?? []) as ProfileRow[]) map.set(row.id, row);
  }
  return map;
}

function compose(
  leads: LeadRow[],
  customers: Map<string, CustomerRow>,
  profiles: Map<string, ProfileRow>,
  qualByLead: Map<string, QualRow>,
): LqtLead[] {
  return leads.map((l) => {
    const q = qualByLead.get(l.id) ?? null;
    return {
      id: l.id,
      title: l.title,
      source: l.source,
      source_reference: l.source_reference,
      customer_query: l.customer_query,
      created_at: l.created_at,
      assigned_to: l.assigned_to,
      customer_id: l.customer_id,
      suggested_assignee_id: l.suggested_assignee_id,
      customer: l.customer_id ? customers.get(l.customer_id) ?? null : null,
      suggested_assignee: l.suggested_assignee_id
        ? (profiles.get(l.suggested_assignee_id) ?? null) as any
        : null,
      qualification: q
        ? {
            id: q.id,
            qualification_type: q.qualification_type,
            routed_to: q.routed_to,
            qualified_at: q.qualified_at,
            decision_reason: q.decision_reason,
          }
        : null,
    } satisfies LqtLead;
  });
}

export function useLqtLeads(tab: LqtTab, range: LqtRange = DEFAULT_RANGE) {
  const { activeVerticalId } = useVertical();
  return useQuery({
    queryKey: ['lqt-leads', tab, range.preset, range.from?.toISOString() ?? null, range.to?.toISOString() ?? null, activeVerticalId],
    queryFn: async (): Promise<LqtLead[]> => {
      const { from: rangeFrom, to: rangeTo } = resolveRange(range);
      const { data, error } = await (supabase as any).rpc('get_lqt_inbox', {
        p_tab: tab,
        p_from: rangeFrom ? rangeFrom.toISOString() : null,
        p_to: rangeTo ? rangeTo.toISOString() : null,
        p_limit: 500,
        p_vertical_id: activeVerticalId,
      });
      if (error) throw error;
      return (data ?? []) as LqtLead[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });
}

export interface OldestPendingLead {
  id: string;
  title: string;
  hoursWaiting: number;
  customer_name: string | null;
}

export interface TeamAgentRow {
  user_id: string;
  name: string;
  qualified: number;
  discarded: number;
  avgMinutes: number | null;
}

export interface LqtStats {
  pending: number;
  oldestPendingHours: number | null;
  oldestPendingLabel: string | null;
  priorityPending: number;
  oldestPendingList: OldestPendingLead[];
  qualifiedToday: number;
  sptToday: number;
  tstToday: number;
  discardedToday: number;
  junkToday: number;
  duplicateToday: number;
  todayDecisionTotal: number;
  discardRatePct: number;
  avgQualMinutes: number | null;
  acceptance: { overall: number; spt: number; tst: number; sptTotal: number; tstTotal: number };
  team: TeamAgentRow[];
  rangeLabel: string;
}

export function useLqtStats(range: LqtRange = DEFAULT_RANGE) {
  return useQuery({
    queryKey: ['lqt-stats', range.preset, range.from?.toISOString() ?? null, range.to?.toISOString() ?? null],
    queryFn: async (): Promise<LqtStats> => {
      const { from: rangeFrom, to: rangeTo, label: rangeLabel } = resolveRange(range);
      const { data, error } = await supabase.rpc('get_lqt_stats', {
        p_from: rangeFrom ? rangeFrom.toISOString() : null,
        p_to: rangeTo ? rangeTo.toISOString() : null,
      });
      if (error) throw error;
      const r: any = data ?? {};
      return {
        pending: r.pending ?? 0,
        oldestPendingHours: r.oldestPendingHours ?? null,
        oldestPendingLabel: r.oldestPendingLabel ?? null,
        priorityPending: r.priorityPending ?? 0,
        oldestPendingList: (r.oldestPendingList ?? []) as OldestPendingLead[],
        qualifiedToday: r.qualifiedToday ?? 0,
        sptToday: r.sptToday ?? 0,
        tstToday: r.tstToday ?? 0,
        discardedToday: r.discardedToday ?? 0,
        junkToday: r.junkToday ?? 0,
        duplicateToday: r.duplicateToday ?? 0,
        todayDecisionTotal: r.todayDecisionTotal ?? 0,
        discardRatePct: r.discardRatePct ?? 0,
        avgQualMinutes: r.avgQualMinutes ?? null,
        acceptance: r.acceptance ?? { overall: 0, spt: 0, tst: 0, sptTotal: 0, tstTotal: 0 },
        team: (r.team ?? []) as TeamAgentRow[],
        rangeLabel,
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });
}

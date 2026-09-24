import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type SptInboxTab = 'new' | 'in_progress' | 'awaiting';

export type SptSource = 'lqt_simple' | 'lqt_technical' | 'cro' | 'direct';

export type PricingMode = 'fast' | 'awaiting' | 'updated' | 'none';

export type DealStage =
  | 'new'
  | 'pricing'
  | 'negotiation'
  | 'follow_up'
  | 'won'
  | 'lost';

export interface PricingSummary {
  total: number;
  verified_auto: number;
  pending: number;
  updated: number;
  mode: PricingMode;
}

export interface SptInboxLead {
  id: string;
  title: string;
  customer_query: string | null;
  created_at: string;
  has_enquiry: boolean | null;
  enquiry_status: string | null;
  customer: {
    id: string;
    company_name: string;
    contact_person: string | null;
    phone: string;
    email: string | null;
    segment: string | null;
  } | null;
  qualification: {
    qualification_type: 'simple' | 'technical' | 'invalid';
    routed_to: 'spt' | 'tst' | 'discard' | 'nurture';
    qualified_at: string;
    qualifier_name: string | null;
  } | null;
  item_count: number;
  total_qty: number;
  source: SptSource;
  handoff_at: string;
  hours_since_handoff: number;
  latest_quotation: {
    id: string;
    status: string;
    sent_at: string | null;
    created_at: string;
    grand_total: number | null;
  } | null;
  pricing_summary: PricingSummary;
  assigned_to: string | null;
  owner_name: string | null;
  stage: 'new' | 'in_progress' | 'awaiting' | 'other';
  // Deal lifecycle (frontend derived)
  deal_stage: DealStage;
  value: number | null;
  lead_status: string | null;
  won_at: string | null;
  lost_at: string | null;
  estimated_value: number | null;
}

function deriveSource(row: any): SptSource {
  if (row.routed_to === 'spt' && row.qualification_type === 'simple') return 'lqt_simple';
  if (row.routed_to === 'spt' && row.qualification_type === 'technical') return 'lqt_technical';
  if (row.routed_to === 'tst') return 'lqt_technical';
  if (row.source === 'cro' || row.source === 'outreach') return 'cro';
  return 'direct';
}

function deriveDealStage(row: any, hoursSinceSent: number | null): DealStage {
  const status = (row.lead_status || '').toLowerCase();
  if (status === 'won' || row.won_at) return 'won';
  if (status === 'lost' || row.lost_at) return 'lost';

  const qStatus = (row.latest_quotation_status || '').toLowerCase();
  if (qStatus === 'accepted') return 'won';
  if (qStatus === 'rejected' || qStatus === 'expired') return 'lost';

  // Has a quotation that's been sent
  if (row.latest_quotation_id && row.latest_quotation_sent_at) {
    if (qStatus === 'revised' || qStatus === 'negotiating') return 'negotiation';
    // sent ≤ 48h: still negotiation; > 48h: needs follow up
    if (hoursSinceSent !== null && hoursSinceSent > 48) return 'follow_up';
    return 'negotiation';
  }

  // Has items but no sent quotation → pricing
  if ((row.item_count || 0) > 0) return 'pricing';

  return 'new';
}

export function useSptInbox(tab: SptInboxTab | 'all') {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  // Realtime: refresh inbox when LQT qualifies, procurement resolves, or pricing flips
  useEffect(() => {
    if (!user?.id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedInvalidate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['spt-inbox'] });
      }, 2_000);
    };

    const channel = supabase
      .channel('spt-inbox-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_qualification' }, debouncedInvalidate)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'price_requests' }, debouncedInvalidate)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'enquiry_items' }, debouncedInvalidate)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'enquiry_items' }, debouncedInvalidate)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, debouncedInvalidate)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quotations' }, debouncedInvalidate)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  return useQuery({
    queryKey: ['spt-inbox', tab, user?.id, isAdmin],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<SptInboxLead[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase.rpc('get_spt_inbox' as any);
      if (error) throw error;

      const now = Date.now();

      const normalized: SptInboxLead[] = (data || []).map((r: any) => {
        const handoff_at = r.handoff_at || r.created_at;
        const hours_since_handoff = (now - new Date(handoff_at).getTime()) / (1000 * 60 * 60);
        const hoursSinceSent = r.latest_quotation_sent_at
          ? (now - new Date(r.latest_quotation_sent_at).getTime()) / (1000 * 60 * 60)
          : null;

        const pricing_summary: PricingSummary = {
          total: r.item_count || 0,
          verified_auto: r.verified_auto || 0,
          pending: r.pending_pricing || 0,
          updated: r.updated_pricing || 0,
          mode: (r.pricing_mode || 'none') as PricingMode,
        };

        const deal_stage = deriveDealStage(r, hoursSinceSent);
        const value =
          r.latest_quotation_grand_total != null && Number(r.latest_quotation_grand_total) > 0
            ? Number(r.latest_quotation_grand_total)
            : r.estimated_value != null && Number(r.estimated_value) > 0
              ? Number(r.estimated_value)
              : null;

        return {
          id: r.id,
          title: r.title,
          customer_query: r.customer_query,
          created_at: r.created_at,
          has_enquiry: r.has_enquiry,
          enquiry_status: r.enquiry_status,
          customer: r.customer_id
            ? {
                id: r.customer_id,
                company_name: r.customer_company,
                contact_person: r.customer_contact,
                phone: r.customer_phone,
                email: r.customer_email,
                segment: r.customer_segment ?? null,
              }
            : null,
          qualification: r.qualified_at
            ? {
                qualification_type: r.qualification_type,
                routed_to: r.routed_to,
                qualified_at: r.qualified_at,
                qualifier_name: r.qualifier_name,
              }
            : null,
          item_count: r.item_count || 0,
          total_qty: Number(r.total_qty) || 0,
          source: deriveSource(r),
          handoff_at,
          hours_since_handoff,
          latest_quotation: r.latest_quotation_id
            ? {
                id: r.latest_quotation_id,
                status: r.latest_quotation_status,
                sent_at: r.latest_quotation_sent_at,
                created_at: r.latest_quotation_created_at,
                grand_total: r.latest_quotation_grand_total != null ? Number(r.latest_quotation_grand_total) : null,
              }
            : null,
          pricing_summary,
          assigned_to: r.assigned_to ?? null,
          owner_name: r.owner_name ?? null,
          stage: r.stage,
          deal_stage,
          value,
          lead_status: r.lead_status ?? null,
          won_at: r.won_at ?? null,
          lost_at: r.lost_at ?? null,
          estimated_value: r.estimated_value != null ? Number(r.estimated_value) : null,
        };
      });

      // Default sort: newest handoff
      normalized.sort((a, b) => new Date(b.handoff_at).getTime() - new Date(a.handoff_at).getTime());
      return normalized;
    },
  });
}

export function slaStatus(hours: number): 'green' | 'yellow' | 'red' {
  if (hours >= 24) return 'red';
  if (hours >= 12) return 'yellow';
  return 'green';
}

export function sourceBadgeMeta(s: SptSource) {
  switch (s) {
    case 'lqt_simple':
      return { label: 'LQT · Simple', className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' };
    case 'lqt_technical':
      return { label: 'TST · Technical', className: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' };
    case 'cro':
      return { label: 'CRO', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' };
    default:
      return { label: 'Direct', className: 'bg-muted text-muted-foreground border-border' };
  }
}

// ---------------- Formatters ----------------

/**
 * Indian short currency: ₹2.8L, ₹45K, ₹1.2Cr
 */
export function formatINRShort(value: number | null | undefined): string {
  if (value == null || isNaN(Number(value))) return '—';
  const n = Math.round(Number(value));
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(n >= 100_000_000 ? 0 : 1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(n >= 1_000_000 ? 0 : 1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n}`;
}

// ---------------- Deal stage meta ----------------

export const dealStageLabels: Record<DealStage, string> = {
  new: 'New',
  pricing: 'Pricing',
  negotiation: 'Negotiation',
  follow_up: 'Follow-up',
  won: 'Won',
  lost: 'Lost',
};

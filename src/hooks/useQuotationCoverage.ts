import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const UNQUOTED_REASONS = [
  'Product Not Found',
  'Model Unclear',
  'Price Not Available',
  'Purchase Price Not Available',
  'Obsolete',
  'Discontinued',
  'Margin Approval Required',
  'Customer Information Missing',
  'Invalid Enquiry',
  'Other',
] as const;

export type UnquotedReason = (typeof UNQUOTED_REASONS)[number];

export interface UnquotedLead {
  id: string;
  title: string | null;
  company_name: string | null;
  created_at: string;
  unquoted_reason: string | null;
}

export interface CoverageGroup {
  key: string;
  label: string;
  total: number;
  quoted: number;
  unquoted: number;
  coveragePct: number;
}

export interface CoverageData {
  totalLeads: number;
  quotedLeads: number;
  unquotedLeads: number;
  coveragePct: number;
  reasonBreakdown: Array<{ reason: string; count: number; pct: number }>;
  unquotedList: UnquotedLead[];
  /** Coverage per salesperson */
  byOwner: CoverageGroup[];
  /** Coverage per department / role */
  byDepartment: CoverageGroup[];
}

interface Range {
  from?: string;
  to?: string;
}

/** Quotation coverage % = quoted leads / qualified leads x 100. Target: 90%+ */
export function useQuotationCoverage(range: Range = {}) {
  return useQuery({
    queryKey: ['quotation-coverage', range.from, range.to],
    queryFn: async (): Promise<CoverageData> => {
      let query = supabase
        .from('leads')
        .select('id, title, company_name, created_at, quoted_at, enquiry_status, unquoted_reason, assigned_to, owner:profiles!leads_assigned_to_fkey(id, full_name, role, department)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (range.from) query = query.gte('created_at', range.from);
      if (range.to) query = query.lte('created_at', range.to);

      const { data, error } = await query;
      if (error) throw error;

      const leads = (data || []) as any[];
      const isQuoted = (l: any) => !!l.quoted_at || ['quoted', 'negotiating', 'price_matched'].includes(l.enquiry_status);

      const quoted = leads.filter(isQuoted);
      const unquoted = leads.filter((l) => !isQuoted(l));
      const total = leads.length;

      const counts = new Map<string, number>();
      for (const l of unquoted) {
        const key = l.unquoted_reason || 'Reason not captured';
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      const group = (keyOf: (l: any) => { key: string; label: string }): CoverageGroup[] => {
        const map = new Map<string, CoverageGroup>();
        for (const l of leads) {
          const { key, label } = keyOf(l);
          const g = map.get(key) ?? { key, label, total: 0, quoted: 0, unquoted: 0, coveragePct: 0 };
          g.total += 1;
          if (isQuoted(l)) g.quoted += 1;
          else g.unquoted += 1;
          map.set(key, g);
        }
        return Array.from(map.values())
          .map((g) => ({ ...g, coveragePct: g.total ? Math.round((g.quoted / g.total) * 1000) / 10 : 0 }))
          .sort((a, b) => b.total - a.total);
      };

      return {
        byOwner: group((l) => ({
          key: l.assigned_to ?? 'unassigned',
          label: l.owner?.full_name || 'Unassigned',
        })),
        byDepartment: group((l) => ({
          key: l.owner?.department || l.owner?.role || 'unknown',
          label: l.owner?.department || l.owner?.role || 'Not set',
        })),
        totalLeads: total,
        quotedLeads: quoted.length,
        unquotedLeads: unquoted.length,
        coveragePct: total ? Math.round((quoted.length / total) * 1000) / 10 : 0,
        reasonBreakdown: Array.from(counts.entries())
          .map(([reason, count]) => ({
            reason,
            count,
            pct: total ? Math.round((count / total) * 1000) / 10 : 0,
          }))
          .sort((a, b) => b.count - a.count),
        unquotedList: unquoted.slice(0, 200).map((l) => ({
          id: l.id,
          title: l.title,
          company_name: l.company_name,
          created_at: l.created_at,
          unquoted_reason: l.unquoted_reason,
        })),
      };
    },
  });
}

export async function setUnquotedReason(leadId: string, reason: string) {
  const { error } = await supabase
    .from('leads')
    .update({ unquoted_reason: reason, unquoted_at: new Date().toISOString() } as any)
    .eq('id', leadId);
  if (error) throw error;
}

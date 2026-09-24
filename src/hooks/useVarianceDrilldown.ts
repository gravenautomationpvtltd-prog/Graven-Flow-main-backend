import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VarianceRow {
  id: string;
  lead_id: string | null;
  item_label: string;
  quantity: number | null;
  office_name: string | null;
  department: string;
  owner_name: string;
  requested_at: string;
  resolved_at: string | null;
  tat_deadline: string | null;
  status: string;
  target_rate: number | null;
  resolved_price: number | null;
  gap_pct: number | null;
  hours_taken: number | null;
  age_days: number | null;
  sales_outcome: string | null;
  severity: number | null;
}

export interface VarianceBreakdownRow {
  dim: 'region' | 'department' | 'owner';
  label: string;
  value: number;
  offenders: number;
  volume: number;
}

export interface VarianceDrilldown {
  metric: string;
  total_offenders: number;
  rows: VarianceRow[];
  breakdown: VarianceBreakdownRow[];
}

/**
 * Rows and region/department/owner breakdown behind a single variance metric,
 * so a card can be opened straight into the requests that cause the mismatch.
 */
export function useVarianceDrilldown(
  metric: string | null,
  from: string,
  to: string,
  officeId: string | null,
  department: string | null,
) {
  return useQuery({
    queryKey: ['variance-drilldown', metric, from, to, officeId, department],
    enabled: !!metric,
    staleTime: 60_000,
    queryFn: async (): Promise<VarianceDrilldown> => {
      const { data, error } = await supabase.rpc('get_variance_drilldown' as any, {
        _metric: metric,
        _from: from,
        _to: to,
        _office: officeId,
        _department: department && department !== 'all' ? department : null,
        _limit: 200,
      } as any);
      if (error) throw error;
      const d = (data ?? {}) as any;
      return {
        metric: d.metric ?? metric ?? '',
        total_offenders: Number(d.total_offenders ?? 0),
        rows: (d.rows ?? []) as VarianceRow[],
        breakdown: (d.breakdown ?? []) as VarianceBreakdownRow[],
      };
    },
  });
}

/** Metrics that support a drill-down, with the label used in the sheet. */
export const DRILLABLE_METRICS: Record<string, { title: string; offenderLabel: string }> = {
  coverage_pct: { title: 'Coverage gap', offenderLabel: 'requests raised without a price' },
  tat_compliance_pct: { title: 'TAT misses', offenderLabel: 'requests resolved after the deadline' },
  target_match_pct: { title: 'Target misses', offenderLabel: 'priced requests that missed the target' },
  price_gap_pct: { title: 'Price gap', offenderLabel: 'requests priced above target' },
  avg_resolution_hours: { title: 'Slowest resolutions', offenderLabel: 'resolved requests' },
  no_price_rate_pct: { title: 'No-price requests', offenderLabel: 'requests closed without a price' },
  backlog_open: { title: 'Open backlog', offenderLabel: 'requests still open' },
  win_rate_pct: { title: 'Lost deals', offenderLabel: 'matched prices marked lost' },
  multi_quote_pct: { title: 'Single-quote pricing', offenderLabel: 'resolved requests' },
};

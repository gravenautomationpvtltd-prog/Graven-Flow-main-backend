import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TargetMatchScorecard {
  requests_raised: number;
  prices_given: number;
  coverage_pct: number;
  no_price_rate_pct: number;
  backlog_open: number;
  target_requests: number;
  target_matched: number;
  target_match_pct: number;
  price_gap_pct: number;
  price_gap_median_pct: number;
  price_gap_p90_pct: number;
  price_gap_worst_pct: number;
  avg_resolution_hours: number;
  median_resolution_hours: number;
  matched_avg_resolution_hours: number;
  tat_met: number;
  tat_missed: number;
  tat_compliance_pct: number;
  breached_open: number;
  outcomes_recorded: number;
  outcome_quoted: number;
  outcome_won: number;
  outcome_lost: number;
  outcome_on_hold: number;
  win_rate_pct: number;
  matched_pending_outcome: number;
  won_avg_gap_pct: number;
  lost_avg_gap_pct: number;
}

const KEYS: (keyof TargetMatchScorecard)[] = [
  'requests_raised', 'prices_given', 'coverage_pct', 'no_price_rate_pct', 'backlog_open',
  'target_requests', 'target_matched', 'target_match_pct', 'price_gap_pct',
  'price_gap_median_pct', 'price_gap_p90_pct', 'price_gap_worst_pct',
  'avg_resolution_hours', 'median_resolution_hours', 'matched_avg_resolution_hours',
  'tat_met', 'tat_missed', 'tat_compliance_pct', 'breached_open',
  'outcomes_recorded', 'outcome_quoted', 'outcome_won', 'outcome_lost', 'outcome_on_hold',
  'win_rate_pct', 'matched_pending_outcome', 'won_avg_gap_pct', 'lost_avg_gap_pct',
];

/**
 * Target-matched workflow metrics: match rate, TAT compliance and price-gap
 * variance, scoped to a region (branch office) and a department.
 */
export function useTargetMatchScorecard(
  from: string,
  to: string,
  officeId: string | null,
  department: string | null,
) {
  return useQuery({
    queryKey: ['target-match-scorecard', from, to, officeId, department],
    staleTime: 60_000,
    queryFn: async (): Promise<TargetMatchScorecard> => {
      const { data, error } = await supabase.rpc('get_target_match_scorecard' as any, {
        _from: from,
        _to: to,
        _office: officeId,
        _department: department && department !== 'all' ? department : null,
      } as any);
      if (error) throw error;
      const out = {} as TargetMatchScorecard;
      KEYS.forEach((k) => ((out as any)[k] = Number((data as any)?.[k] ?? 0)));
      return out;
    },
  });
}

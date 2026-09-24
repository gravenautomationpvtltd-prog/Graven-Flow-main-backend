import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProcurementScorecard {
  requests_raised: number;
  requests_unassigned: number;
  prices_given: number;
  no_price: number;
  backlog_open: number;
  age_0_1: number;
  age_1_3: number;
  age_3_7: number;
  age_7_plus: number;
  oldest_open_days: number;
  avg_resolution_hours: number;
  median_resolution_hours: number;
  tat_met: number;
  tat_missed: number;
  breached_open: number;
  escalated_open: number;
  target_requests: number;
  target_matched: number;
  avg_gap_vs_target_pct: number;
  quotes_captured: number;
  quotes_pushed: number;
  multi_quote_items: number;
  quoted_items: number;
  suppliers_quoted: number;
  negotiation_saving_pct: number;
  po_count: number;
  po_value: number;
  suppliers_new: number;
  grn_count: number;
}

export interface TeamBoardRow {
  user_id: string;
  user_name: string;
  assigned_count: number;
  open_count: number;
  resolved_count: number;
  no_price_count: number;
  avg_resolution_hours: number;
  tat_met: number;
  tat_missed: number;
  breached_open: number;
  quotes_captured: number;
  target_matched: number;
  po_count: number;
  po_value: number;
}

const num = (v: any) => Number(v ?? 0);

function normalize(raw: any): ProcurementScorecard {
  const keys: (keyof ProcurementScorecard)[] = [
    'requests_raised', 'requests_unassigned', 'prices_given', 'no_price', 'backlog_open',
    'age_0_1', 'age_1_3', 'age_3_7', 'age_7_plus', 'oldest_open_days',
    'avg_resolution_hours', 'median_resolution_hours', 'tat_met', 'tat_missed',
    'breached_open', 'escalated_open', 'target_requests', 'target_matched',
    'avg_gap_vs_target_pct', 'quotes_captured', 'quotes_pushed', 'multi_quote_items',
    'quoted_items', 'suppliers_quoted', 'negotiation_saving_pct', 'po_count', 'po_value',
    'suppliers_new', 'grn_count',
  ];
  const out = {} as ProcurementScorecard;
  keys.forEach((k) => ((out as any)[k] = num(raw?.[k])));
  return out;
}

/** Headline procurement metrics for a period, optionally scoped to one member. */
export function useProcurementScorecard(from: string, to: string, userId?: string | null) {
  return useQuery({
    queryKey: ['procurement-scorecard', from, to, userId ?? null],
    staleTime: 60_000,
    queryFn: async (): Promise<ProcurementScorecard> => {
      const { data, error } = await supabase.rpc('get_procurement_scorecard' as any, {
        _from: from,
        _to: to,
        _user: userId ?? null,
      } as any);
      if (error) throw error;
      return normalize(data);
    },
  });
}

/** Per-member procurement performance board. */
export function useProcurementTeamBoard(from: string, to: string) {
  return useQuery({
    queryKey: ['procurement-team-board', from, to],
    staleTime: 60_000,
    queryFn: async (): Promise<TeamBoardRow[]> => {
      const { data, error } = await supabase.rpc('get_procurement_team_board' as any, {
        _from: from,
        _to: to,
      } as any);
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        user_id: r.user_id,
        user_name: r.user_name || 'Unknown',
        assigned_count: num(r.assigned_count),
        open_count: num(r.open_count),
        resolved_count: num(r.resolved_count),
        no_price_count: num(r.no_price_count),
        avg_resolution_hours: num(r.avg_resolution_hours),
        tat_met: num(r.tat_met),
        tat_missed: num(r.tat_missed),
        breached_open: num(r.breached_open),
        quotes_captured: num(r.quotes_captured),
        target_matched: num(r.target_matched),
        po_count: num(r.po_count),
        po_value: num(r.po_value),
      }));
    },
  });
}

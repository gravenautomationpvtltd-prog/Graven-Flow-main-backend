import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SupplierQuoteStat {
  supplier_id: string | null;
  supplier_name: string;
  quotes_count: number;
  pushed_count: number;
  win_rate: number | null;
  avg_lead_time: number | null;
  avg_price: number | null;
  target_met_count: number;
  avg_gap_vs_lowest_pct: number | null;
  last_quoted_at: string | null;
}

/** Per-supplier quoting performance across price requests. */
export function useSupplierQuoteStats(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['supplier-quote-stats', range?.from, range?.to],
    queryFn: async (): Promise<SupplierQuoteStat[]> => {
      const { data, error } = await supabase.rpc('get_supplier_quote_stats' as any, {
        _from: range?.from ?? new Date(Date.now() - 365 * 864e5).toISOString(),
        _to: range?.to ?? new Date().toISOString(),
      } as any);
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        ...r,
        quotes_count: Number(r.quotes_count || 0),
        pushed_count: Number(r.pushed_count || 0),
        target_met_count: Number(r.target_met_count || 0),
        win_rate: r.win_rate == null ? null : Number(r.win_rate),
        avg_lead_time: r.avg_lead_time == null ? null : Number(r.avg_lead_time),
        avg_price: r.avg_price == null ? null : Number(r.avg_price),
        avg_gap_vs_lowest_pct:
          r.avg_gap_vs_lowest_pct == null ? null : Number(r.avg_gap_vs_lowest_pct),
      })) as SupplierQuoteStat[];
    },
  });
}

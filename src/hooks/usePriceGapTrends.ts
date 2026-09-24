import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const sel = (s: string): string => s;

export interface GapQuote {
  id: string;
  created_at: string;
  price_request_id: string;
  supplier_id: string | null;
  supplier_name: string;
  purchase_price: number;
  is_pushed: boolean;
  item_key: string;
  item_label: string;
  target_rate: number | null;
  lowest_price: number;
  gap_vs_lowest_pct: number;
  gap_vs_target_pct: number | null;
}

export interface GapSeriesPoint {
  period: string; // YYYY-MM
  label: string;
  [seriesKey: string]: number | string | null;
}

export interface GapTrendData {
  quotes: GapQuote[];
  items: { key: string; label: string; quotes: number }[];
  suppliers: { key: string; label: string; quotes: number }[];
  periods: string[];
}

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (k: string) =>
  new Date(`${k}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

/**
 * Loads captured supplier quotes and derives, per quote, how far the price sits
 * above the lowest quote for the same item and above the sales target rate.
 */
export function usePriceGapTrends(opts: { days?: number; supplierId?: string } = {}) {
  const days = opts.days ?? 180;
  return useQuery({
    queryKey: ['price-gap-trends', days, opts.supplierId ?? null],
    staleTime: 60_000,
    queryFn: async (): Promise<GapTrendData> => {
      const from = new Date(Date.now() - days * 864e5).toISOString();

      const { data: qData, error } = await supabase
        .from('price_request_quotes')
        .select(
          sel(
            'id, created_at, price_request_id, supplier_id, supplier_name, purchase_price, is_pushed'
          )
        )
        .gte('created_at', from)
        .order('created_at', { ascending: true })
        .limit(5000);
      if (error) throw error;

      let quotes = (qData || []) as any[];
      if (opts.supplierId) {
        const prIds = new Set(
          quotes.filter((q) => q.supplier_id === opts.supplierId).map((q) => q.price_request_id)
        );
        quotes = quotes.filter((q) => prIds.has(q.price_request_id));
      }
      if (quotes.length === 0)
        return { quotes: [], items: [], suppliers: [], periods: [] };

      const prIds = [...new Set(quotes.map((q) => q.price_request_id))];
      const prRows: any[] = [];
      for (let i = 0; i < prIds.length; i += 300) {
        const { data } = await supabase
          .from('price_requests')
          .select(sel('id, enquiry_item_id, target_rate'))
          .in('id', prIds.slice(i, i + 300));
        prRows.push(...(data || []));
      }
      const prMap = new Map(prRows.map((r) => [r.id, r]));

      const eiIds = [...new Set(prRows.map((r) => r.enquiry_item_id).filter(Boolean))] as string[];
      const eiRows: any[] = [];
      for (let i = 0; i < eiIds.length; i += 300) {
        const { data } = await supabase
          .from('enquiry_items')
          .select(sel('id, product_query_text, target_rate'))
          .in('id', eiIds.slice(i, i + 300));
        eiRows.push(...(data || []));
      }
      const eiMap = new Map(eiRows.map((r) => [r.id, r]));

      // lowest price captured per price request (same item, same ask)
      const lowest = new Map<string, number>();
      for (const q of quotes) {
        const p = Number(q.purchase_price || 0);
        if (!p) continue;
        const cur = lowest.get(q.price_request_id);
        if (cur == null || p < cur) lowest.set(q.price_request_id, p);
      }

      const out: GapQuote[] = [];
      for (const q of quotes) {
        const price = Number(q.purchase_price || 0);
        if (!price) continue;
        const pr = prMap.get(q.price_request_id);
        const ei = pr?.enquiry_item_id ? eiMap.get(pr.enquiry_item_id) : null;
        const label = (ei?.product_query_text || 'Unlabelled item').toString().trim();
        const target = pr?.target_rate ?? ei?.target_rate ?? null;
        const low = lowest.get(q.price_request_id) ?? price;
        out.push({
          id: q.id,
          created_at: q.created_at,
          price_request_id: q.price_request_id,
          supplier_id: q.supplier_id,
          supplier_name: q.supplier_name || 'Unlinked supplier',
          purchase_price: price,
          is_pushed: !!q.is_pushed,
          item_key: (pr?.enquiry_item_id as string) || q.price_request_id,
          item_label: label.length > 60 ? `${label.slice(0, 60)}…` : label,
          target_rate: target == null ? null : Number(target),
          lowest_price: low,
          gap_vs_lowest_pct: low > 0 ? ((price - low) / low) * 100 : 0,
          gap_vs_target_pct:
            target && Number(target) > 0 ? ((price - Number(target)) / Number(target)) * 100 : null,
        });
      }

      const count = (key: 'item' | 'supplier') => {
        const m = new Map<string, { key: string; label: string; quotes: number }>();
        for (const q of out) {
          const k = key === 'item' ? q.item_key : q.supplier_id || q.supplier_name;
          const label = key === 'item' ? q.item_label : q.supplier_name;
          const e = m.get(k) || { key: k, label, quotes: 0 };
          e.quotes += 1;
          m.set(k, e);
        }
        return [...m.values()].sort((a, b) => b.quotes - a.quotes);
      };

      const periods = [...new Set(out.map((q) => monthKey(q.created_at)))].sort();

      return { quotes: out, items: count('item'), suppliers: count('supplier'), periods };
    },
  });
}

/** Aggregates quotes into a monthly average-gap series per selected group. */
export function buildGapSeries(
  quotes: GapQuote[],
  groupBy: 'item' | 'supplier',
  keys: string[],
  metric: 'lowest' | 'target'
): { data: GapSeriesPoint[]; seriesKeys: string[] } {
  const keyOf = (q: GapQuote) =>
    groupBy === 'item' ? q.item_key : q.supplier_id || q.supplier_name;
  const labelOf = (q: GapQuote) => (groupBy === 'item' ? q.item_label : q.supplier_name);

  const selected = new Set(keys);
  const rows = quotes.filter((q) => selected.has(keyOf(q)));
  const periods = [...new Set(rows.map((q) => monthKey(q.created_at)))].sort();
  const labels = new Map<string, string>();
  rows.forEach((q) => labels.set(keyOf(q), labelOf(q)));

  const data: GapSeriesPoint[] = periods.map((p) => {
    const point: GapSeriesPoint = { period: p, label: monthLabel(p) };
    for (const k of keys) {
      const vals = rows
        .filter((q) => keyOf(q) === k && monthKey(q.created_at) === p)
        .map((q) => (metric === 'lowest' ? q.gap_vs_lowest_pct : q.gap_vs_target_pct))
        .filter((v): v is number => v != null);
      point[labels.get(k) || k] =
        vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
    }
    return point;
  });

  return { data, seriesKeys: keys.map((k) => labels.get(k) || k) };
}

/** Returns the exact quotes that produced one plotted point (group + month). */
export function selectGapQuotes(
  quotes: GapQuote[],
  groupBy: 'item' | 'supplier',
  key: string,
  period: string
): GapQuote[] {
  const keyOf = (q: GapQuote) =>
    groupBy === 'item' ? q.item_key : q.supplier_id || q.supplier_name;
  return quotes
    .filter((q) => keyOf(q) === key && monthKey(q.created_at) === period)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export const gapMonthLabel = monthLabel;
export const gapMonthKey = monthKey;

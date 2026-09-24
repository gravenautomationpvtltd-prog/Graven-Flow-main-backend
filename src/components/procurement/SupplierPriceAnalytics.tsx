import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Trophy } from 'lucide-react';
import { useSupplierQuoteStats } from '@/hooks/useSupplierQuoteAnalytics';

const inr = (n?: number | null) =>
  n == null ? '—' : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;

/** Supplier quoting performance, sourced from procurement's captured quotes. */
export function SupplierPriceAnalytics({ supplierId }: { supplierId?: string }) {
  const [days, setDays] = useState('365');
  const from = useMemo(
    () => new Date(Date.now() - Number(days || 365) * 864e5).toISOString(),
    [days]
  );
  const { data = [], isLoading } = useSupplierQuoteStats({ from });

  const rows = supplierId ? data.filter((r) => r.supplier_id === supplierId) : data;

  const totals = rows.reduce(
    (a, r) => ({
      quotes: a.quotes + r.quotes_count,
      pushed: a.pushed + r.pushed_count,
      target: a.target + r.target_met_count,
    }),
    { quotes: 0, pushed: 0, target: 0 }
  );

  const exportCsv = () => {
    const head = [
      'Supplier',
      'Quotes',
      'Pushed to sales',
      'Win rate %',
      'Avg lead time (d)',
      'Avg price',
      'Met target',
      'Avg gap vs lowest %',
      'Last quoted',
    ];
    const body = rows.map((r) => [
      r.supplier_name,
      r.quotes_count,
      r.pushed_count,
      r.win_rate ?? '',
      r.avg_lead_time ?? '',
      r.avg_price ?? '',
      r.target_met_count,
      r.avg_gap_vs_lowest_pct ?? '',
      r.last_quoted_at ? new Date(r.last_quoted_at).toLocaleDateString('en-IN') : '',
    ]);
    const csv = [head, ...body]
      .map((line) => line.map((c) => `"${String(c ?? '')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supplier-price-performance.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const best = rows.length
    ? [...rows]
        .filter((r) => r.avg_gap_vs_lowest_pct != null)
        .sort((a, b) => (a.avg_gap_vs_lowest_pct! - b.avg_gap_vs_lowest_pct!))
        .slice(0, 3)
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Supplier price performance</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {totals.quotes} quote{totals.quotes === 1 ? '' : 's'} captured · {totals.pushed}{' '}
            pushed to sales · {totals.target} met the sales target
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            className="h-9 w-24"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            title="Days to look back"
          />
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No supplier quotes captured in this period. Quotes logged in “Fill prices” appear
            here.
          </p>
        ) : (
          <>
            {!supplierId && best.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Most competitive:</span>
                {best.map((b) => (
                  <Badge key={b.supplier_name} variant="secondary" className="text-xs">
                    {b.supplier_name} · +{b.avg_gap_vs_lowest_pct}% vs lowest
                  </Badge>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">Supplier</th>
                    <th className="py-2 pr-3 text-right">Quotes</th>
                    <th className="py-2 pr-3 text-right">Pushed</th>
                    <th className="py-2 pr-3 text-right">Win rate</th>
                    <th className="py-2 pr-3 text-right">Avg lead</th>
                    <th className="py-2 pr-3 text-right">Avg price</th>
                    <th className="py-2 pr-3 text-right">Met target</th>
                    <th className="py-2 pr-3 text-right">Gap vs lowest</th>
                    <th className="py-2 text-right">Last quoted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.supplier_id || r.supplier_name} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.supplier_name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.quotes_count}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.pushed_count}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {r.win_rate == null ? '—' : `${r.win_rate}%`}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {r.avg_lead_time == null ? '—' : `${r.avg_lead_time}d`}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{inr(r.avg_price)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.target_met_count}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {r.avg_gap_vs_lowest_pct == null
                          ? '—'
                          : `${r.avg_gap_vs_lowest_pct > 0 ? '+' : ''}${r.avg_gap_vs_lowest_pct}%`}
                      </td>
                      <td className="py-2 text-right text-xs text-muted-foreground">
                        {r.last_quoted_at
                          ? new Date(r.last_quoted_at).toLocaleDateString('en-IN')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

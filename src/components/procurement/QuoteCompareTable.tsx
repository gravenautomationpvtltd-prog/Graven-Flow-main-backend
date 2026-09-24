import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { PriceValidityBadge } from '@/components/shared/PriceValidityBadge';
import type { PriceQuote } from '@/hooks/usePriceRequestQuotes';

const inr = (n?: number | null) =>
  n == null ? '—' : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;

const effective = (q: PriceQuote) => Number(q.sale_price ?? q.purchase_price);

/** Side-by-side comparison of the quotes procurement selected. */
export function QuoteCompareTable({
  quotes,
  targetRate,
  onPush,
  pushing,
}: {
  quotes: PriceQuote[];
  targetRate?: number | null;
  onPush: (q: PriceQuote) => void;
  pushing?: boolean;
}) {
  if (quotes.length < 2) return null;

  const best = quotes.reduce((a, b) => (effective(a) <= effective(b) ? a : b)).id;
  const withLead = quotes.filter((q) => q.lead_time_days != null);
  const fastest = withLead.length
    ? withLead.reduce((a, b) => (Number(a.lead_time_days) <= Number(b.lead_time_days) ? a : b)).id
    : null;
  const withValidity = quotes.filter((q) => q.valid_until);
  const longest = withValidity.length
    ? withValidity.reduce((a, b) => (String(a.valid_until) >= String(b.valid_until) ? a : b)).id
    : null;
  const lowestPrice = effective(quotes.find((q) => q.id === best)!);

  return (
    <div className="rounded-md border bg-background overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">Supplier</th>
            <th className="px-3 py-2 font-medium text-right">Price</th>
            <th className="px-3 py-2 font-medium text-right">vs lowest</th>
            <th className="px-3 py-2 font-medium text-right">vs target</th>
            <th className="px-3 py-2 font-medium">Validity</th>
            <th className="px-3 py-2 font-medium text-right">Lead</th>
            <th className="px-3 py-2 font-medium text-right">MOQ</th>
            <th className="px-3 py-2 font-medium">Notes</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => {
            const price = effective(q);
            const diff = price - lowestPrice;
            const tgt = targetRate != null ? price - Number(targetRate) : null;
            return (
              <tr key={q.id} className="border-t align-top">
                <td className="px-3 py-2">
                  <span className="font-medium">{q.supplier_name || 'Unnamed supplier'}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {q.id === best && (
                      <Badge variant="secondary" className="text-[10px]">Best price</Badge>
                    )}
                    {q.id === fastest && (
                      <Badge variant="outline" className="text-[10px]">Fastest</Badge>
                    )}
                    {q.id === longest && (
                      <Badge variant="outline" className="text-[10px]">Longest validity</Badge>
                    )}
                    {q.is_pushed && <Badge className="text-[10px]">Pushed</Badge>}
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{inr(price)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {diff === 0 ? '—' : `+${inr(diff)}`}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums ${
                    tgt == null ? 'text-muted-foreground' : tgt <= 0 ? 'text-emerald-600' : 'text-destructive'
                  }`}
                >
                  {tgt == null ? '—' : `${tgt <= 0 ? '−' : '+'}${inr(Math.abs(tgt))}`}
                </td>
                <td className="px-3 py-2">
                  <PriceValidityBadge validUntil={q.valid_until} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {q.lead_time_days != null ? `${q.lead_time_days}d` : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{q.moq ?? '—'}</td>
                <td className="px-3 py-2 max-w-[180px] break-words text-muted-foreground">
                  {q.notes || '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant={q.is_pushed ? 'outline' : 'default'}
                    className="h-7"
                    disabled={pushing}
                    onClick={() => onPush(q)}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    {q.is_pushed ? 'Re-push' : 'Push'}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

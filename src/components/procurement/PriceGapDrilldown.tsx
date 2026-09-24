import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, ExternalLink } from 'lucide-react';
import type { GapQuote } from '@/hooks/usePriceGapTrends';
import { gapMonthLabel } from '@/hooks/usePriceGapTrends';

const inr = (n: number | null | undefined) =>
  n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`;

export interface GapDrilldownTarget {
  period: string;
  seriesLabel: string;
  groupKey: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: GapDrilldownTarget | null;
  quotes: GapQuote[];
  metric: 'lowest' | 'target';
}

/** Shows every supplier quote behind one plotted monthly gap point, with the maths. */
export function PriceGapDrilldown({ open, onOpenChange, target, quotes, metric }: Props) {
  const gapOf = (q: GapQuote) =>
    metric === 'lowest' ? q.gap_vs_lowest_pct : q.gap_vs_target_pct;

  const { counted, average } = useMemo(() => {
    const vals = quotes.map(gapOf).filter((v): v is number => v != null);
    return {
      counted: vals,
      average: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes, metric]);

  const exportCsv = () => {
    const head = [
      'Date',
      'Item',
      'Supplier',
      'Quoted price',
      'Lowest for request',
      'Target rate',
      metric === 'lowest' ? 'Gap vs lowest %' : 'Gap vs target %',
      'Pushed to sales',
    ];
    const body = quotes.map((q) => [
      new Date(q.created_at).toLocaleDateString('en-IN'),
      q.item_label,
      q.supplier_name,
      Math.round(q.purchase_price),
      Math.round(q.lowest_price),
      q.target_rate ?? '',
      gapOf(q)?.toFixed(2) ?? '',
      q.is_pushed ? 'Yes' : 'No',
    ]);
    const csv = [head, ...body]
      .map((l) => l.map((c) => `"${String(c ?? '')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `price-gap-${target?.period ?? 'month'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base">
            {target ? `${target.seriesLabel} — ${gapMonthLabel(target.period)}` : 'Quote detail'}
          </SheetTitle>
          <SheetDescription>
            {quotes.length} quote{quotes.length === 1 ? '' : 's'} captured
            {average != null && (
              <>
                {' '}· average gap{' '}
                <span className="font-medium text-foreground">{average.toFixed(1)}%</span>{' '}
                {metric === 'lowest' ? 'vs lowest quote' : 'vs target rate'}
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[86px]">Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Quoted</TableHead>
                <TableHead className="text-right">Lowest</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Gap</TableHead>
                <TableHead className="w-[52px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => {
                const gap = gapOf(q);
                const excluded = gap == null;
                return (
                  <TableRow key={q.id} className={excluded ? 'opacity-50' : undefined}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(q.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </TableCell>
                    <TableCell className="text-xs max-w-[220px] break-words">
                      {q.item_label}
                      {q.is_pushed && (
                        <Badge variant="secondary" className="ml-1.5 text-[10px]">
                          Pushed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{q.supplier_name}</TableCell>
                    <TableCell className="text-xs text-right">{inr(q.purchase_price)}</TableCell>
                    <TableCell className="text-xs text-right">{inr(q.lowest_price)}</TableCell>
                    <TableCell className="text-xs text-right">{inr(q.target_rate)}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">
                      {gap == null ? '—' : `${gap.toFixed(1)}%`}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                        <Link to={`/procurement?request=${q.price_request_id}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {quotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    No quotes for this point.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="border-t pt-3 space-y-2">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">How this point is calculated: </span>
            average = ({counted.map((v) => `${v.toFixed(1)}%`).join(' + ') || '—'}) ÷{' '}
            {counted.length || 0} ={' '}
            <span className="font-medium text-foreground">
              {average == null ? '—' : `${average.toFixed(1)}%`}
            </span>
          </div>
          {metric === 'target' && counted.length < quotes.length && (
            <p className="text-xs text-muted-foreground">
              {quotes.length - counted.length} quote(s) have no target rate and are excluded from
              the average (shown greyed above).
            </p>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!quotes.length}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export these rows
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

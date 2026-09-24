import { useMemo } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  ArrowRight, 
  Plus, 
  Minus, 
  Equal, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { QuotationVersion, QuotationVersionItem } from '@/hooks/useQuotationVersions';
import { cn } from '@/lib/utils';

interface QuotationVersionCompareProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionA: QuotationVersion | null;
  versionB: QuotationVersion | null;
  versionALabel?: string;
  versionBLabel?: string;
}

interface ItemDiff {
  description: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  versionA?: QuotationVersionItem;
  versionB?: QuotationVersionItem;
  changes?: {
    quantity?: { from: number; to: number };
    rate?: { from: number; to: number };
    amount?: { from: number; to: number };
  };
}

export function QuotationVersionCompare({
  open,
  onOpenChange,
  versionA,
  versionB,
  versionALabel = 'Version A',
  versionBLabel = 'Version B',
}: QuotationVersionCompareProps) {
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const itemDiffs = useMemo((): ItemDiff[] => {
    if (!versionA || !versionB) return [];

    const itemsA = versionA.items_snapshot || [];
    const itemsB = versionB.items_snapshot || [];
    const diffs: ItemDiff[] = [];

    // Create maps by description for matching
    const mapA = new Map(itemsA.map(item => [item.description.toLowerCase().trim(), item]));
    const mapB = new Map(itemsB.map(item => [item.description.toLowerCase().trim(), item]));

    // Check items in version A
    itemsA.forEach(itemA => {
      const key = itemA.description.toLowerCase().trim();
      const itemB = mapB.get(key);

      if (!itemB) {
        // Item was removed in version B
        diffs.push({
          description: itemA.description,
          status: 'removed',
          versionA: itemA,
        });
      } else {
        // Item exists in both - check for modifications
        const hasChanges = 
          itemA.quantity !== itemB.quantity ||
          itemA.rate !== itemB.rate ||
          itemA.amount !== itemB.amount;

        if (hasChanges) {
          diffs.push({
            description: itemA.description,
            status: 'modified',
            versionA: itemA,
            versionB: itemB,
            changes: {
              quantity: itemA.quantity !== itemB.quantity 
                ? { from: itemA.quantity, to: itemB.quantity } 
                : undefined,
              rate: itemA.rate !== itemB.rate 
                ? { from: itemA.rate, to: itemB.rate } 
                : undefined,
              amount: itemA.amount !== itemB.amount 
                ? { from: itemA.amount, to: itemB.amount } 
                : undefined,
            },
          });
        } else {
          diffs.push({
            description: itemA.description,
            status: 'unchanged',
            versionA: itemA,
            versionB: itemB,
          });
        }
      }
    });

    // Check for items added in version B
    itemsB.forEach(itemB => {
      const key = itemB.description.toLowerCase().trim();
      if (!mapA.has(key)) {
        diffs.push({
          description: itemB.description,
          status: 'added',
          versionB: itemB,
        });
      }
    });

    return diffs;
  }, [versionA, versionB]);

  const summary = useMemo(() => {
    const added = itemDiffs.filter(d => d.status === 'added').length;
    const removed = itemDiffs.filter(d => d.status === 'removed').length;
    const modified = itemDiffs.filter(d => d.status === 'modified').length;
    const unchanged = itemDiffs.filter(d => d.status === 'unchanged').length;

    const totalA = versionA?.grand_total || 0;
    const totalB = versionB?.grand_total || 0;
    const totalDiff = totalB - totalA;
    const percentChange = totalA > 0 ? ((totalDiff / totalA) * 100) : 0;

    return { added, removed, modified, unchanged, totalDiff, percentChange };
  }, [itemDiffs, versionA, versionB]);

  if (!versionA || !versionB) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Compare: {versionALabel} <ArrowRight className="h-4 w-4" /> {versionBLabel}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                  <Plus className="h-4 w-4" />
                  <span className="text-lg font-semibold">{summary.added}</span>
                </div>
                <p className="text-xs text-muted-foreground">Added</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                  <Minus className="h-4 w-4" />
                  <span className="text-lg font-semibold">{summary.removed}</span>
                </div>
                <p className="text-xs text-muted-foreground">Removed</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
                  <ArrowRight className="h-4 w-4" />
                  <span className="text-lg font-semibold">{summary.modified}</span>
                </div>
                <p className="text-xs text-muted-foreground">Modified</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Equal className="h-4 w-4" />
                  <span className="text-lg font-semibold">{summary.unchanged}</span>
                </div>
                <p className="text-xs text-muted-foreground">Unchanged</p>
              </div>
              <div className={cn(
                "rounded-lg border p-3 text-center",
                summary.totalDiff > 0 ? "bg-green-50 border-green-200" : 
                summary.totalDiff < 0 ? "bg-red-50 border-red-200" : ""
              )}>
                <div className={cn(
                  "flex items-center justify-center gap-1 mb-1",
                  summary.totalDiff > 0 ? "text-green-600" : 
                  summary.totalDiff < 0 ? "text-red-600" : "text-muted-foreground"
                )}>
                  {summary.totalDiff > 0 ? <TrendingUp className="h-4 w-4" /> : 
                   summary.totalDiff < 0 ? <TrendingDown className="h-4 w-4" /> : null}
                  <span className="text-sm font-semibold">
                    {summary.totalDiff > 0 ? '+' : ''}{formatCurrency(summary.totalDiff)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.percentChange !== 0 && `(${summary.percentChange > 0 ? '+' : ''}${summary.percentChange.toFixed(1)}%)`}
                </p>
              </div>
            </div>

            {/* Version Header Comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 bg-muted/30">
                <h4 className="font-medium mb-2">{versionALabel}</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Date:</span> {format(new Date(versionA.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                  <p><span className="text-muted-foreground">Items:</span> {versionA.items_snapshot.length}</p>
                  <p><span className="text-muted-foreground">Total:</span> {formatCurrency(versionA.grand_total)}</p>
                </div>
              </div>
              <div className="rounded-lg border p-4 bg-muted/30">
                <h4 className="font-medium mb-2">{versionBLabel}</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Date:</span> {format(new Date(versionB.created_at), 'dd MMM yyyy, hh:mm a')}</p>
                  <p><span className="text-muted-foreground">Items:</span> {versionB.items_snapshot.length}</p>
                  <p><span className="text-muted-foreground">Total:</span> {formatCurrency(versionB.grand_total)}</p>
                </div>
              </div>
            </div>

            {/* Items Comparison Table */}
            <div>
              <h4 className="font-medium mb-3">Item Changes</h4>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-right p-3 font-medium">Qty</th>
                      <th className="text-right p-3 font-medium">Rate</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemDiffs.map((diff, index) => (
                      <tr 
                        key={index} 
                        className={cn(
                          "border-t",
                          diff.status === 'added' && "bg-green-50",
                          diff.status === 'removed' && "bg-red-50",
                          diff.status === 'modified' && "bg-amber-50"
                        )}
                      >
                        <td className="p-3">
                          <Badge 
                            variant="outline"
                            className={cn(
                              "text-xs",
                              diff.status === 'added' && "border-green-500 text-green-700 bg-green-100",
                              diff.status === 'removed' && "border-red-500 text-red-700 bg-red-100",
                              diff.status === 'modified' && "border-amber-500 text-amber-700 bg-amber-100",
                              diff.status === 'unchanged' && "border-muted-foreground/30"
                            )}
                          >
                            {diff.status === 'added' && <Plus className="h-3 w-3 mr-1" />}
                            {diff.status === 'removed' && <Minus className="h-3 w-3 mr-1" />}
                            {diff.status === 'modified' && <ArrowRight className="h-3 w-3 mr-1" />}
                            {diff.status}
                          </Badge>
                        </td>
                        <td className="p-3 max-w-[200px]">
                          <span className={cn(
                            diff.status === 'removed' && "line-through text-muted-foreground"
                          )}>
                            {diff.description}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {diff.status === 'modified' && diff.changes?.quantity ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-muted-foreground line-through">{diff.changes.quantity.from}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="font-medium">{diff.changes.quantity.to}</span>
                            </div>
                          ) : (
                            diff.versionB?.quantity || diff.versionA?.quantity
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {diff.status === 'modified' && diff.changes?.rate ? (
                            <div className="flex flex-col items-end">
                              <span className="text-muted-foreground line-through text-xs">{formatCurrency(diff.changes.rate.from)}</span>
                              <span className="font-medium">{formatCurrency(diff.changes.rate.to)}</span>
                            </div>
                          ) : (
                            formatCurrency(diff.versionB?.rate || diff.versionA?.rate)
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {diff.status === 'modified' && diff.changes?.amount ? (
                            <div className="flex flex-col items-end">
                              <span className="text-muted-foreground line-through text-xs">{formatCurrency(diff.changes.amount.from)}</span>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">{formatCurrency(diff.changes.amount.to)}</span>
                                {diff.changes.amount.to > diff.changes.amount.from ? (
                                  <ArrowUpRight className="h-3 w-3 text-green-600" />
                                ) : (
                                  <ArrowDownRight className="h-3 w-3 text-red-600" />
                                )}
                              </div>
                            </div>
                          ) : (
                            formatCurrency(diff.versionB?.amount || diff.versionA?.amount)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <h5 className="text-sm font-medium mb-3">{versionALabel} Totals</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(versionA.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-red-600">-{formatCurrency(versionA.total_discount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(versionA.total_tax)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Grand Total</span>
                    <span>{formatCurrency(versionA.grand_total)}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <h5 className="text-sm font-medium mb-3">{versionBLabel} Totals</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(versionB.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-red-600">-{formatCurrency(versionB.total_discount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(versionB.total_tax)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Grand Total</span>
                    <span>{formatCurrency(versionB.grand_total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

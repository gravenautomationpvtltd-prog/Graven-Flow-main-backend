import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { XCircle, Send, Layers, ChevronDown, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import {
  useResolveBatch,
  useBulkResolvePrices,
  useMarkNoPrice,
  type ResolveRow,
} from '@/hooks/usePriceResolveSheet';
import {
  requestRef,
  useCanSeeCustomerName,
  useCanViewSupplierQuotes,
} from '@/lib/procurement-privacy';
import { PriceValidityBadge } from '@/components/shared/PriceValidityBadge';
import { SupplierPicker } from '@/components/procurement/SupplierPicker';
import { QuoteComparePanel } from './QuoteComparePanel';
import type { QueueRow } from '@/hooks/usePriceRequestQueue';

const inr = (n?: number | null) =>
  n == null ? '—' : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;

interface PriceRow {
  price: string;
  validUntil: string;
  supplier: string;
  supplierId: string;
  lead: string;
  notes: string;
}

interface Draft {
  rows: PriceRow[];
  chosen: number;
}

const emptyRow = (): PriceRow => ({
  price: '',
  validUntil: '',
  supplier: '',
  supplierId: '',
  lead: '',
  notes: '',
});

const emptyDraft = (): Draft => ({ rows: [emptyRow()], chosen: 0 });

export function PriceResolveSheet({
  request,
  open,
  onOpenChange,
  onChanged,
}: {
  request: QueueRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) {
  const canSeeCustomer = useCanSeeCustomerName();
  const canCompareQuotes = useCanViewSupplierQuotes();
  const { data: rows = [], isLoading, refetch } = useResolveBatch(
    request ? { id: request.id, lead_id: request.lead_id } : null
  );
  const bulkResolve = useBulkResolvePrices();
  const markNoPrice = useMarkNoPrice();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) {
      setDrafts({});
      setExpanded({});
    }
  }, [open]);

  const getDraft = (id: string) => drafts[id] || emptyDraft();

  const updateDraft = (id: string, fn: (d: Draft) => Draft) =>
    setDrafts((prev) => ({ ...prev, [id]: fn(prev[id] || emptyDraft()) }));

  const setField = (id: string, index: number, field: keyof PriceRow, value: string) =>
    updateDraft(id, (d) => ({
      ...d,
      rows: d.rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    }));

  const addRow = (id: string) =>
    updateDraft(id, (d) => ({ ...d, rows: [...d.rows, emptyRow()] }));

  const removeRow = (id: string, index: number) =>
    updateDraft(id, (d) => {
      const next = d.rows.filter((_, i) => i !== index);
      const rowsLeft = next.length ? next : [emptyRow()];
      const chosen = d.chosen >= rowsLeft.length ? 0 : d.chosen > index ? d.chosen - 1 : d.chosen;
      return { rows: rowsLeft, chosen };
    });

  const filledRows = (d: Draft) =>
    d.rows
      .map((r, i) => ({ ...r, index: i, num: Number(r.price) }))
      .filter((r) => r.price !== '' && r.num > 0);

  const filled = useMemo(
    () => rows.filter((r) => filledRows(getDraft(r.id)).length > 0),
    [rows, drafts]
  );

  const save = async () => {
    if (!filled.length) return;
    await bulkResolve.mutateAsync(
      filled.map((r: ResolveRow) => {
        const d = getDraft(r.id);
        const list = filledRows(d);
        const chosen = list.find((x) => x.index === d.chosen) || list[0];
        const others = list.filter((x) => x !== chosen);
        const map = (x: (typeof list)[number]) => ({
          price: x.num,
          supplierName: x.supplier || null,
          supplierId: x.supplierId || null,
          leadTimeDays: x.lead ? Number(x.lead) : null,
          validUntil: x.validUntil || null,
          notes: x.notes || null,
        });
        return { request: r, ...map(chosen), alternates: others.map(map) };
      })
    );
    setDrafts({});
    onChanged?.();
    onOpenChange(false);
  };

  if (!request) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Fill prices</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{requestRef(request.id)}</span>
            {canSeeCustomer && request.customer_name && (
              <span className="text-xs">· {request.customer_name}</span>
            )}
            <Badge variant="outline" className="text-xs">
              {rows.length} item{rows.length === 1 ? '' : 's'} in this enquiry
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            rows.map((r, i) => {
              const d = getDraft(r.id);
              const list = filledRows(d);
              const lowest = list.length
                ? list.reduce((a, b) => (a.num <= b.num ? a : b)).index
                : -1;
              return (
                <div key={r.id} className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold break-words">
                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                        {r.product_text}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[
                          r.brand,
                          `Qty ${r.quantity ?? 1}`,
                          r.target_rate != null ? `Target ${inr(r.target_rate)}` : null,
                          r.id === request.id ? 'selected' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {canCompareQuotes && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => setExpanded((e) => ({ ...e, [r.id]: !e[r.id] }))}
                        >
                          {expanded[r.id] ? (
                            <ChevronDown className="h-4 w-4 mr-1" />
                          ) : (
                            <Layers className="h-4 w-4 mr-1" />
                          )}
                          Compare quotes
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-muted-foreground"
                        title="No price available"
                        onClick={() => markNoPrice.mutate(r.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        No price
                      </Button>
                    </div>
                  </div>

                  {d.rows.map((row, idx) => {
                    const priceNum = Number(row.price);
                    const meetsTarget =
                      r.target_rate != null && priceNum > 0 && priceNum <= Number(r.target_rate);
                    const isChosen = d.chosen === idx;
                    return (
                      <div
                        key={idx}
                        className={`rounded-md border p-3 space-y-3 ${
                          isChosen && d.rows.length > 1 ? 'border-primary bg-primary/5' : 'bg-muted/20'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium">Price {idx + 1}</p>
                            {lowest === idx && list.length > 1 && (
                              <Badge variant="secondary" className="text-[10px]">
                                Lowest
                              </Badge>
                            )}
                            {meetsTarget && (
                              <Badge variant="outline" className="text-[10px]">
                                Meets target
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {d.rows.length > 1 && (
                              <Button
                                size="sm"
                                variant={isChosen ? 'default' : 'ghost'}
                                className="h-7 text-xs"
                                onClick={() => updateDraft(r.id, (x) => ({ ...x, chosen: idx }))}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                {isChosen ? 'Sending to sales' : 'Send this one'}
                              </Button>
                            )}
                            {d.rows.length > 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => removeRow(r.id, idx)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Price (₹)</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              placeholder="0"
                              className="h-11 text-base font-semibold tabular-nums"
                              value={row.price}
                              onChange={(e) => setField(r.id, idx, 'price', e.target.value)}
                            />
                            <p className="text-xs h-4">
                              {priceNum > 0 ? (
                                <span
                                  className={
                                    meetsTarget ? 'text-emerald-600' : 'text-muted-foreground'
                                  }
                                >
                                  {inr(priceNum)}
                                  {meetsTarget ? ' · meets target' : ''}
                                </span>
                              ) : null}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Price valid until</Label>
                            <Input
                              type="date"
                              className="h-11"
                              value={row.validUntil}
                              onChange={(e) => setField(r.id, idx, 'validUntil', e.target.value)}
                            />
                            <div className="h-4">
                              <PriceValidityBadge validUntil={row.validUntil || null} />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Supplier</Label>
                            <SupplierPicker
                              className="h-11"
                              value={{
                                supplierId: row.supplierId || null,
                                supplierName: row.supplier,
                              }}
                              onChange={(v) =>
                                updateDraft(r.id, (x) => ({
                                  ...x,
                                  rows: x.rows.map((rr, i) =>
                                    i === idx
                                      ? {
                                          ...rr,
                                          supplierId: v.supplierId || '',
                                          supplier: v.supplierName,
                                        }
                                      : rr
                                  ),
                                }))
                              }
                            />
                            <div className="h-4" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Lead time (days)</Label>
                            <Input
                              type="number"
                              placeholder="—"
                              className="h-11"
                              value={row.lead}
                              onChange={(e) => setField(r.id, idx, 'lead', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1 md:col-span-3">
                            <Label className="text-xs">Notes</Label>
                            <Input
                              placeholder="Optional — validity is added automatically"
                              className="h-11"
                              value={row.notes}
                              onChange={(e) => setField(r.id, idx, 'notes', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {d.rows.length > 1
                        ? 'Only the selected price goes to sales — the rest stay in procurement for comparison.'
                        : 'Got more than one supplier price? Add them all.'}
                    </p>
                    <Button size="sm" variant="secondary" onClick={() => addRow(r.id)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add another price
                    </Button>
                  </div>

                  {canCompareQuotes && expanded[r.id] && (
                    <QuoteComparePanel
                      request={{
                        id: r.id,
                        lead_id: r.lead_id,
                        enquiry_item_id: r.enquiry_item_id,
                        requested_by: r.requested_by,
                        target_rate: r.target_rate,
                        product_text: r.product_text,
                        current_round: r.current_round,
                      }}
                      onChanged={() => {
                        refetch();
                        onChanged?.();
                      }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        <Separator className="my-4" />

        <div className="flex items-center justify-between gap-3 pb-6">
          <p className="text-xs text-muted-foreground">
            Rows left blank stay pending. Prices and their validity are sent to sales as soon
            as you save.
          </p>
          <Button disabled={!filled.length || bulkResolve.isPending} onClick={save}>
            <Send className="h-4 w-4 mr-1" />
            Save {filled.length || ''} price{filled.length === 1 ? '' : 's'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

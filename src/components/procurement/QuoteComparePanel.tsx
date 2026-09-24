import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { PriceValidityBadge } from '@/components/shared/PriceValidityBadge';
import { SupplierPicker } from '@/components/procurement/SupplierPicker';

import { Trash2, Send, Plus, CheckCircle2, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { QuoteCompareTable } from './QuoteCompareTable';
import {
  usePriceQuotes,
  useAddPriceQuote,
  useDeletePriceQuote,
  usePushQuoteToSales,
  type PriceQuote,
} from '@/hooks/usePriceRequestQuotes';

export interface QuoteTargetRequest {
  id: string;
  lead_id: string | null;
  enquiry_item_id: string | null;
  requested_by: string | null;
  target_rate: number | null;
  product_text: string;
  current_round?: number | null;
}

const inr = (n?: number | null) =>
  n == null ? '—' : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;

const emptyForm = () => ({
  supplier_id: '',
  supplier_name: '',
  purchase_price: '',
  sale_price: '',
  lead_time_days: '',
  moq: '',
  valid_until: '',
  notes: '',
});


/**
 * Procurement-only vendor comparison: capture as many supplier quotes as needed
 * for one item, then push exactly one of them to sales. Non-pushed quotes stay
 * internal to procurement and can be pushed later during a revision round.
 */
export function QuoteComparePanel({
  request,
  onChanged,
}: {
  request: QuoteTargetRequest;
  onChanged?: () => void;
}) {
  const { data: quotes = [], isLoading } = usePriceQuotes(request.id);
  const addQuote = useAddPriceQuote();
  const deleteQuote = useDeletePriceQuote();
  const pushQuote = usePushQuoteToSales();
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const toggleSelected = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selectedQuotes = quotes.filter((q) => selected.includes(q.id));

  const effective = (q: PriceQuote) => q.sale_price ?? q.purchase_price;
  const cheapest = quotes.length
    ? quotes.reduce((a, b) => (effective(a) <= effective(b) ? a : b)).id
    : null;

  const set = (k: keyof ReturnType<typeof emptyForm>, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const add = async () => {
    const price = Number(form.purchase_price);
    if (!price || price <= 0) return;
    await addQuote.mutateAsync({
      price_request_id: request.id,
      round: request.current_round || 1,
      supplier_id: form.supplier_id || null,
      supplier_name: form.supplier_name || null,

      purchase_price: price,
      sale_price: form.sale_price ? Number(form.sale_price) : null,
      lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
      moq: form.moq ? Number(form.moq) : null,
      valid_until: form.valid_until || null,
      notes: form.notes || null,
    });
    setForm(emptyForm());
    setShowForm(false);
    onChanged?.();
  };

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">
          Supplier quotes ({quotes.length}){' '}
          <span className="text-muted-foreground font-normal">
            · visible to procurement only
          </span>
        </p>
        {request.target_rate != null && (
          <span className="text-xs text-muted-foreground">
            Sales target {inr(request.target_rate)}
          </span>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : quotes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No quotes captured yet. Add each supplier response below.
        </p>
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => {
            const price = effective(q);
            const meetsTarget =
              request.target_rate != null && price <= Number(request.target_rate);
            return (
              <div
                key={q.id}
                className={`flex flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2 ${
                  q.is_pushed ? 'border-primary' : ''
                }`}
              >
                <Checkbox
                  checked={selected.includes(q.id)}
                  onCheckedChange={() => toggleSelected(q.id)}
                  aria-label="Select quote to compare"
                />
                <div className="min-w-[140px] flex-1">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {q.supplier_name || 'Unnamed supplier'}
                    {!q.supplier_id && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        not linked
                      </Badge>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {[
                      `Round ${q.round}`,
                      `logged by ${q.created_by_name || 'unknown'} on ${new Date(
                        q.created_at
                      ).toLocaleDateString('en-IN')}`,
                      q.is_pushed && q.pushed_at
                        ? `pushed by ${q.pushed_by_name || 'procurement'} on ${new Date(
                            q.pushed_at
                          ).toLocaleDateString('en-IN')}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {[
                      q.lead_time_days != null ? `${q.lead_time_days}d lead` : null,
                      q.moq != null ? `MOQ ${q.moq}` : null,
                      q.notes,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No extra details'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold">{inr(price)}</p>
                  {q.sale_price != null && q.sale_price !== q.purchase_price && (
                    <p className="text-xs text-muted-foreground">
                      cost {inr(q.purchase_price)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {q.is_pushed && (
                    <Badge className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Pushed
                    </Badge>
                  )}
                  {cheapest === q.id && !q.is_pushed && (
                    <Badge variant="secondary" className="text-xs">
                      Lowest
                    </Badge>
                  )}
                  <PriceValidityBadge validUntil={q.valid_until} />
                  {meetsTarget && (
                    <Badge variant="outline" className="text-xs">
                      Meets target
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    size="sm"
                    variant={q.is_pushed ? 'outline' : 'default'}
                    className="h-8"
                    disabled={pushQuote.isPending}
                    onClick={async () => {
                      await pushQuote.mutateAsync({ quote: q, request });
                      onChanged?.();
                    }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    {q.is_pushed ? 'Re-push' : 'Push to sales'}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={deleteQuote.isPending}
                    onClick={async () => {
                      await deleteQuote.mutateAsync({ id: q.id, priceRequestId: request.id });
                      onChanged?.();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedQuotes.length >= 2 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">
              Comparing {selectedQuotes.length} quotes
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setSelected([])}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Clear selection
            </Button>
          </div>
          <QuoteCompareTable
            quotes={selectedQuotes}
            targetRate={request.target_rate}
            pushing={pushQuote.isPending}
            onPush={async (q) => {
              await pushQuote.mutateAsync({ quote: q, request });
              onChanged?.();
            }}
          />
        </div>
      )}

      {selected.length === 1 && (
        <p className="text-xs text-muted-foreground">
          Select one more quote to compare side by side.
        </p>
      )}

      {!showForm ? (
        <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add quote
        </Button>
      ) : (
      <div className="rounded-md border bg-background p-3 space-y-3">
        <p className="text-xs font-medium">Add a supplier quote</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Supplier</Label>
            <SupplierPicker
              className="h-10"
              value={{ supplierId: form.supplier_id || null, supplierName: form.supplier_name }}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  supplier_id: v.supplierId || '',
                  supplier_name: v.supplierName,
                }))
              }
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Cost (₹)</Label>
            <Input
              className="h-10 font-semibold tabular-nums"
              type="number"
              placeholder="0"
              value={form.purchase_price}
              onChange={(e) => set('purchase_price', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sale price ₹ (optional)</Label>
            <Input
              className="h-10 tabular-nums"
              type="number"
              placeholder="0"
              value={form.sale_price}
              onChange={(e) => set('sale_price', e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Valid until</Label>
            <Input
              className="h-10"
              type="date"
              value={form.valid_until}
              onChange={(e) => set('valid_until', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Lead time (days)</Label>
            <Input
              className="h-10"
              type="number"
              placeholder="—"
              value={form.lead_time_days}
              onChange={(e) => set('lead_time_days', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">MOQ</Label>
            <Input
              className="h-10"
              type="number"
              placeholder="—"
              value={form.moq}
              onChange={(e) => set('moq', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input
              className="h-10"
              placeholder="Optional"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!form.purchase_price || addQuote.isPending}
            onClick={add}
          >
            <Plus className="h-4 w-4 mr-1" /> Save quote
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}

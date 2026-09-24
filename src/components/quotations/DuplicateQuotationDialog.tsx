import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Search } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import type { QuotationWithDetails, QuotationItem } from '@/hooks/useQuotations';
import { ensureItemsWithModelNumber } from '@/lib/quotation-item-utils';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';
import { toast } from 'sonner';

export interface DuplicateSelection {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  leadId?: string;
  items: QuotationItem[];
}

interface DuplicateQuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: QuotationWithDetails | null;
  /** Lead the source quotation belongs to (kept when copying to the same customer) */
  sourceLeadId?: string;
  onConfirm: (selection: DuplicateSelection) => void;
}

function recalcLine(item: QuotationItem, quantity: number): QuotationItem {
  const qty = quantity;
  const gross = qty * (Number(item.rate) || 0);
  const discountAmount = Math.round(gross * ((Number(item.discount_percent) || 0) / 100) * 100) / 100;
  const taxable = gross - discountAmount;
  const taxAmount = Math.round(taxable * ((Number(item.tax_percent) || 0) / 100) * 100) / 100;
  const amount = Math.round((taxable + taxAmount) * 100) / 100;
  return {
    ...item,
    quantity: qty,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    amount,
  };
}

export function DuplicateQuotationDialog({
  open,
  onOpenChange,
  quotation,
  sourceLeadId,
  onConfirm,
}: DuplicateQuotationDialogProps) {
  const [target, setTarget] = useState<'same' | 'other'>('same');
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const { data: customerResult, isLoading: isSearching } = useCustomers({
    search: search.trim() || undefined,
    pageSize: 20,
  });
  const customers = customerResult?.data ?? [];

  const currency = (quotation?.currency as string) || 'INR';

  // Load full items (with model numbers) whenever the dialog opens
  useEffect(() => {
    if (!open || !quotation) return;
    let cancelled = false;
    setIsLoading(true);
    setTarget('same');
    setSearch('');
    setSelectedCustomerId(undefined);
    ensureItemsWithModelNumber(quotation.id, quotation.items as any[] | undefined)
      .then((loaded) => {
        if (cancelled) return;
        const list = (loaded || []) as QuotationItem[];
        setItems(list);
        setSelectedIdx(new Set(list.map((_, i) => i)));
      })
      .catch((err) => {
        console.error('Failed to load quotation items for duplication:', err);
        toast.error('Could not load the quotation line items');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, quotation?.id]);

  const toggle = (index: number) => {
    setSelectedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const allSelected = items.length > 0 && selectedIdx.size === items.length;

  const selectedTotal = useMemo(
    () => items.reduce((sum, item, i) => (selectedIdx.has(i) ? sum + (Number(item.amount) || 0) : sum), 0),
    [items, selectedIdx],
  );

  const selectedCustomer = customers.find((c: any) => c.id === selectedCustomerId);

  const handleConfirm = () => {
    if (selectedIdx.size === 0) {
      toast.error('Select at least one line item to copy');
      return;
    }
    if (target === 'other' && !selectedCustomerId) {
      toast.error('Choose the customer to copy this quotation to');
      return;
    }

    const chosen = items
      .filter((_, i) => selectedIdx.has(i))
      .map((item, index) => {
        const copy: any = { ...item };
        delete copy.id;
        delete copy.quotation_id;
        delete copy.created_at;
        delete copy.updated_at;
        copy.enquiry_item_id = null;
        copy.sort_order = index;
        return copy as QuotationItem;
      });

    if (target === 'other') {
      onConfirm({
        customerId: selectedCustomerId,
        customerName: (selectedCustomer as any)?.company_name,
        customerPhone: (selectedCustomer as any)?.phone || undefined,
        customerEmail: (selectedCustomer as any)?.email || undefined,
        leadId: undefined,
        items: chosen,
      });
    } else {
      onConfirm({
        customerId: quotation?.customer_id || undefined,
        customerName: quotation?.customer?.company_name,
        customerPhone: quotation?.customer?.phone || undefined,
        customerEmail: quotation?.customer?.email || undefined,
        leadId: sourceLeadId || quotation?.lead_id || undefined,
        items: chosen,
      });
    }
    onOpenChange(false);
  };

  if (!quotation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Duplicate {quotation.quotation_number}</DialogTitle>
          <DialogDescription>
            Copy this quotation in full or in part, to the same customer or to a different one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Copy to */}
          <div className="space-y-3">
            <Label>Copy to</Label>
            <RadioGroup value={target} onValueChange={(v) => setTarget(v as 'same' | 'other')}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="same" id="dup-same" />
                <Label htmlFor="dup-same" className="font-normal">
                  Same customer ({quotation.customer?.company_name || 'current customer'})
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="other" id="dup-other" />
                <Label htmlFor="dup-other" className="font-normal">
                  Another customer
                </Label>
              </div>
            </RadioGroup>

            {target === 'other' && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search customer by name, contact or phone"
                    className="pl-8"
                  />
                </div>
                <ScrollArea className="h-40">
                  <div className="space-y-1 pr-2">
                    {isSearching && (
                      <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                      </div>
                    )}
                    {!isSearching && customers.length === 0 && (
                      <p className="p-2 text-sm text-muted-foreground">No customers found</p>
                    )}
                    {customers.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCustomerId(c.id)}
                        className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${
                          selectedCustomerId === c.id ? 'bg-muted font-medium' : ''
                        }`}
                      >
                        {c.company_name}
                        {c.contact_person ? (
                          <span className="text-muted-foreground"> — {c.contact_person}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line items to copy</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedIdx(allSelected ? new Set() : new Set(items.map((_, i) => i)))
                }
              >
                {allSelected ? 'Clear all' : 'Select all'}
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading items...
              </div>
            ) : (
              <ScrollArea className="max-h-72 rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="w-10 p-2"></th>
                      <th className="p-2">Item</th>
                      <th className="w-24 p-2 text-right">Qty</th>
                      <th className="w-28 p-2 text-right">Rate</th>
                      <th className="w-32 p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 align-top">
                          <Checkbox checked={selectedIdx.has(i)} onCheckedChange={() => toggle(i)} />
                        </td>
                        <td className="p-2">
                          {(item as any).model_number && (
                            <div className="font-medium">{(item as any).model_number}</div>
                          )}
                          <div className="text-muted-foreground">{item.description}</div>
                        </td>
                        <td className="p-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            value={item.quantity}
                            disabled={!selectedIdx.has(i)}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((it, idx) =>
                                  idx === i ? recalcLine(it, parseFloat(e.target.value) || 0) : it,
                                ),
                              )
                            }
                            className="h-8 text-right"
                          />
                        </td>
                        <td className="p-2 text-right">{formatCurrencyWithSymbol(Number(item.rate) || 0, currency as any)}</td>
                        <td className="p-2 text-right">{formatCurrencyWithSymbol(Number(item.amount) || 0, currency as any)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedIdx.size} of {items.length} item{items.length === 1 ? '' : 's'} selected
              </span>
              <span className="font-semibold">{formatCurrencyWithSymbol(selectedTotal, currency as any)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

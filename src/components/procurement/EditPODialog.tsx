import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useActiveSuppliers } from '@/hooks/useSuppliers';
import { usePurchaseOrder, useUpdatePurchaseOrder } from '@/hooks/usePurchaseOrders';
import { POBuilder } from './POBuilder';
import { POLineItemData } from './POLineItem';
import { type CurrencyCode } from '@/lib/currency-utils';

interface EditPODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string | null;
}

export function EditPODialog({ open, onOpenChange, poId }: EditPODialogProps) {
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [orderDate, setOrderDate] = useState<Date | undefined>(new Date());
  const [expectedDelivery, setExpectedDelivery] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [items, setItems] = useState<POLineItemData[]>([]);

  const handleCurrencyChange = (newCurrency: CurrencyCode, newRate: number) => {
    setCurrency(newCurrency);
    setExchangeRate(newRate);
  };

  const { data: po, isLoading } = usePurchaseOrder(poId || undefined);
  const { data: suppliers = [] } = useActiveSuppliers();
  const updatePO = useUpdatePurchaseOrder();

  const selectedSupplier = suppliers.find(s => s.id === supplierId);

  // Populate form when PO data loads
  useEffect(() => {
    if (po && open) {
      setSupplierId(po.supplier_id);
      setOrderDate(po.order_date ? parseISO(po.order_date) : new Date());
      setExpectedDelivery(po.expected_delivery ? parseISO(po.expected_delivery) : undefined);
      setNotes(po.notes || '');
      setTerms(po.terms_conditions || '');
      setCurrency((po.currency as CurrencyCode) || 'INR');
      setExchangeRate((po as any).exchange_rate || 1);
      
      if (po.items && po.items.length > 0) {
        setItems(po.items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          description: item.description,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          rate: item.rate,
          tax_percent: item.tax_percent,
          tax_amount: item.tax_amount,
          amount: item.amount,
          received_quantity: item.received_quantity,
        })));
      } else {
        setItems([{
          id: crypto.randomUUID(),
          product_id: null,
          description: '',
          hsn_code: null,
          quantity: 1,
          rate: 0,
          tax_percent: 18,
          tax_amount: 0,
          amount: 0,
          received_quantity: 0,
        }]);
      }
    }
  }, [po, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!poId) return;

    const validItems = items.filter(item => item.description.trim());
    if (validItems.length === 0) {
      return;
    }

    try {
      await updatePO.mutateAsync({
        id: poId,
        supplier_id: supplierId,
        order_date: orderDate ? format(orderDate, 'yyyy-MM-dd') : null,
        expected_delivery: expectedDelivery ? format(expectedDelivery, 'yyyy-MM-dd') : null,
        notes: notes || null,
        terms_conditions: terms || null,
        currency,
        exchange_rate: exchangeRate,
        items: validItems.map(item => ({
          product_id: item.product_id,
          description: item.description,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          rate: item.rate,
          tax_percent: item.tax_percent,
          tax_amount: item.tax_amount,
          amount: item.amount,
          received_quantity: item.received_quantity || 0,
          sort_order: 0,
        })),
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading purchase order...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950">
        <DialogHeader>
          <DialogTitle>Edit Purchase Order - {po?.po_number}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Supplier *</Label>
              <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedSupplier?.name || 'Select supplier...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search suppliers..." />
                    <CommandList>
                      <CommandEmpty>No suppliers found.</CommandEmpty>
                      <CommandGroup>
                        {suppliers.map((supplier) => (
                          <CommandItem
                            key={supplier.id}
                            value={supplier.name}
                            onSelect={() => {
                              setSupplierId(supplier.id);
                              setSupplierOpen(false);
                            }}
                          >
                            <Check
                              className={cn('mr-2 h-4 w-4', supplierId === supplier.id ? 'opacity-100' : 'opacity-0')}
                            />
                            {supplier.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Order Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {orderDate ? format(orderDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={orderDate} onSelect={setOrderDate} />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Expected Delivery</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expectedDelivery ? format(expectedDelivery, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={expectedDelivery} onSelect={setExpectedDelivery} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Line Items</Label>
            <POBuilder items={items} onChange={setItems} currency={currency} onCurrencyChange={handleCurrencyChange} exchangeRate={exchangeRate} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="terms">Terms & Conditions</Label>
              <Textarea
                id="terms"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updatePO.isPending || !supplierId}>
              {updatePO.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, CalendarIcon, Package, Target, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useActiveSuppliers } from '@/hooks/useSuppliers';
import { useCreatePurchaseOrder } from '@/hooks/usePurchaseOrders';
import { useSalesOrder } from '@/hooks/useSalesOrders';
import { POBuilder } from './POBuilder';
import { POLineItemData } from './POLineItem';
import { Badge } from '@/components/ui/badge';
import { type CurrencyCode } from '@/lib/currency-utils';

// Hook to fetch quotation items with target rates
function useQuotationTargets(quotationId: string | null | undefined) {
  return useQuery({
    queryKey: ['quotation-targets', quotationId],
    queryFn: async () => {
      if (!quotationId) return [];
      const { data, error } = await supabase
        .from('quotation_items')
        .select('id, description, quantity, rate, target_rate')
        .eq('quotation_id', quotationId)
        .not('target_rate', 'is', null)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!quotationId,
  });
}

interface CreatePODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrderId?: string;
}

export function CreatePODialog({ open, onOpenChange, salesOrderId }: CreatePODialogProps) {
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [orderDate, setOrderDate] = useState<Date | undefined>(new Date());
  const [expectedDelivery, setExpectedDelivery] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [items, setItems] = useState<POLineItemData[]>([{
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

  const handleCurrencyChange = (newCurrency: CurrencyCode, newRate: number) => {
    setCurrency(newCurrency);
    setExchangeRate(newRate);
  };

  const { data: suppliers = [] } = useActiveSuppliers();
  const { data: salesOrder } = useSalesOrder(salesOrderId);
  const { data: targetItems = [] } = useQuotationTargets(salesOrder?.quotation_id);
  const createPO = useCreatePurchaseOrder();

  // Pre-fill notes with sales order info
  useEffect(() => {
    if (salesOrder) {
      setNotes(`For Sales Order: ${salesOrder.order_number}\nCustomer: ${salesOrder.customer?.company_name || 'N/A'}`);
    }
  }, [salesOrder]);

  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  
  // Check if any items have target rates
  const hasTargetPrices = targetItems.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter(item => item.description.trim());
    if (validItems.length === 0) {
      return;
    }

    try {
      await createPO.mutateAsync({
        supplier_id: supplierId,
        sales_order_id: salesOrderId || null,
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
          received_quantity: 0,
          sort_order: 0,
        })),
      });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const resetForm = () => {
    setSupplierId(null);
    setOrderDate(new Date());
    setExpectedDelivery(undefined);
    setNotes('');
    setTerms('');
    setCurrency('INR');
    setExchangeRate(1);
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
        </DialogHeader>
        
        {/* Sales Order Reference */}
        {salesOrder && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <Package className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Creating PO for {salesOrder.order_number}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {salesOrder.customer?.company_name} • ₹{salesOrder.order_value?.toLocaleString()}
              </p>
            </div>
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              Linked
            </Badge>
          </div>
        )}

        {/* Target Prices Reference Panel */}
        {hasTargetPrices && (
          <div className="rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-amber-800 dark:text-amber-300">
                Customer Target Prices (Reference)
              </span>
            </div>
            <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1 mb-2">
              <AlertTriangle className="h-3 w-3" />
              Your procurement price should be below these for margin
            </div>
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {targetItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm bg-white dark:bg-slate-900 p-2 rounded border">
                  <span className="truncate flex-1 mr-2">{item.description}</span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-muted-foreground">
                      Qty: {item.quantity}
                    </span>
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      Target: ₹{item.target_rate?.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (Quoted: ₹{item.rate?.toLocaleString()})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
            <Button type="submit" disabled={createPO.isPending || !supplierId}>
              {createPO.isPending ? 'Creating...' : 'Create PO'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

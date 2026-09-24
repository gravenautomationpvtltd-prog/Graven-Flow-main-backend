import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCreateDispatch } from '@/hooks/useDispatches';

interface CreateDispatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCustomerId?: string | null;
  defaultLeadId?: string | null;
  salesOrderId?: string | null;
}

interface DispatchItemData {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
}

export function CreateDispatchDialog({ 
  open, 
  onOpenChange,
  defaultCustomerId,
  defaultLeadId,
  salesOrderId,
}: CreateDispatchDialogProps) {
  const [customerId, setCustomerId] = useState<string | null>(defaultCustomerId || null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [quotationId, setQuotationId] = useState<string | null>(null);
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [dispatchDate, setDispatchDate] = useState<Date | undefined>(new Date());
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DispatchItemData[]>([{
    id: crypto.randomUUID(),
    product_id: null,
    description: '',
    quantity: 1,
  }]);

  // Update customerId when defaultCustomerId changes
  useEffect(() => {
    if (defaultCustomerId) {
      setCustomerId(defaultCustomerId);
    }
  }, [defaultCustomerId]);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, contact_person, address, city, state, pincode')
        .order('company_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ['quotations', 'sent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotations')
        .select(`
          id, 
          quotation_number, 
          customer_id,
          items:quotation_items(description, quantity)
        `)
        .in('status', ['sent', 'approved'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createDispatch = useCreateDispatch();

  const selectedCustomer = customers.find(c => c.id === customerId);
  const selectedQuotation = quotations.find(q => q.id === quotationId);

  // Auto-fill items when quotation is selected
  useEffect(() => {
    if (selectedQuotation && selectedQuotation.items) {
      setItems(selectedQuotation.items.map((item: { description: string; quantity: number }) => ({
        id: crypto.randomUUID(),
        product_id: null,
        description: item.description,
        quantity: item.quantity,
      })));
      // Also set customer if not already set
      if (selectedQuotation.customer_id && !customerId) {
        setCustomerId(selectedQuotation.customer_id);
      }
    }
  }, [quotationId]);

  // Auto-fill shipping address when customer is selected
  useEffect(() => {
    if (selectedCustomer && !shippingAddress) {
      const address = [
        selectedCustomer.address,
        selectedCustomer.city,
        selectedCustomer.state,
        selectedCustomer.pincode
      ].filter(Boolean).join(', ');
      setShippingAddress(address);
    }
  }, [customerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter(item => item.description.trim());
    if (!customerId || validItems.length === 0) return;

    try {
      await createDispatch.mutateAsync({
        customer_id: customerId,
        quotation_id: quotationId,
        lead_id: defaultLeadId || null,
        sales_order_id: salesOrderId || null,
        dispatch_date: dispatchDate ? format(dispatchDate, 'yyyy-MM-dd') : null,
        courier_name: courierName || null,
        tracking_number: trackingNumber || null,
        shipping_address: shippingAddress || null,
        notes: notes || null,
        items: validItems.map(item => ({
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
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
    setCustomerId(null);
    setQuotationId(null);
    setDispatchDate(new Date());
    setCourierName('');
    setTrackingNumber('');
    setShippingAddress('');
    setNotes('');
    setItems([{
      id: crypto.randomUUID(),
      product_id: null,
      description: '',
      quantity: 1,
    }]);
  };

  const addItem = () => {
    setItems([...items, {
      id: crypto.randomUUID(),
      product_id: null,
      description: '',
      quantity: 1,
    }]);
  };

  const updateItem = (index: number, field: keyof DispatchItemData, value: unknown) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Dispatch</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Quotation Selection */}
            <div>
              <Label>From Quotation (Optional)</Label>
              <Popover open={quotationOpen} onOpenChange={setQuotationOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedQuotation?.quotation_number || 'Select quotation...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search quotations..." />
                    <CommandList>
                      <CommandEmpty>No quotations found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value=""
                          onSelect={() => {
                            setQuotationId(null);
                            setQuotationOpen(false);
                          }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', !quotationId ? 'opacity-100' : 'opacity-0')} />
                          None
                        </CommandItem>
                        {quotations.map((q) => (
                          <CommandItem
                            key={q.id}
                            value={q.quotation_number}
                            onSelect={() => {
                              setQuotationId(q.id);
                              setQuotationOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', quotationId === q.id ? 'opacity-100' : 'opacity-0')} />
                            {q.quotation_number}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Customer Selection */}
            <div>
              <Label>Customer *</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedCustomer?.company_name || 'Select customer...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search customers..." />
                    <CommandList>
                      <CommandEmpty>No customers found.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.company_name}
                            onSelect={() => {
                              setCustomerId(customer.id);
                              setCustomerOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', customerId === customer.id ? 'opacity-100' : 'opacity-0')} />
                            {customer.company_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Dispatch Date */}
            <div>
              <Label>Dispatch Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dispatchDate ? format(dispatchDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dispatchDate} onSelect={setDispatchDate} />
                </PopoverContent>
              </Popover>
            </div>

            {/* Courier */}
            <div>
              <Label htmlFor="courier">Courier Name</Label>
              <Input
                id="courier"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="e.g., BlueDart, DTDC"
              />
            </div>

            {/* Tracking Number */}
            <div>
              <Label htmlFor="tracking">Tracking Number</Label>
              <Input
                id="tracking"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Shipping Address */}
          <div>
            <Label htmlFor="address">Shipping Address</Label>
            <Textarea
              id="address"
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              rows={2}
            />
          </div>

          {/* Items */}
          <div>
            <Label className="mb-2 block">Items</Label>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={item.id} className="flex gap-2 items-center">
                  <Input
                    className="flex-1"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    placeholder="Item description"
                  />
                  <Input
                    type="number"
                    className="w-24"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    placeholder="Qty"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    disabled={items.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={addItem} className="mt-2 w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDispatch.isPending || !customerId}>
              {createDispatch.isPending ? 'Creating...' : 'Create Dispatch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

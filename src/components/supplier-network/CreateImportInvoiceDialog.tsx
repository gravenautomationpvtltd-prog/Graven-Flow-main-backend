import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useCreateImportInvoice, type ImportInvoiceItem } from '@/hooks/useImportInvoices';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const currencies = ['USD', 'EUR', 'GBP', 'RMB', 'RUB', 'AED', 'JPY'];

export function CreateImportInvoiceDialog({ open, onOpenChange }: Props) {
  const createMutation = useCreateImportInvoice();

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [poId, setPoId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState('');
  const [shipping, setShipping] = useState('0');
  const [insurance, setInsurance] = useState('0');
  const [customsDuty, setCustomsDuty] = useState('0');
  const [igst, setIgst] = useState('0');
  const [otherCharges, setOtherCharges] = useState('0');
  const [billOfEntry, setBillOfEntry] = useState('');
  const [awbBl, setAwbBl] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ImportInvoiceItem[]>([
    { description: '', quantity: 1, unit_price: 0, total: 0, sort_order: 0 },
  ]);

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['approved-suppliers-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('application_status', 'approved')
        .order('company_name');
      return data || [];
    },
    enabled: open,
  });

  // Fetch POs for selected supplier
  const { data: pos = [] } = useQuery({
    queryKey: ['supplier-pos', supplierId],
    queryFn: async () => {
      const { data } = await supabase
        .from('purchase_orders')
        .select('id, po_number, currency')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!supplierId && open,
  });

  // When PO is selected, set currency
  useEffect(() => {
    if (poId) {
      const po = pos.find((p: any) => p.id === poId);
      if (po?.currency) setCurrency(po.currency);
    }
  }, [poId, pos]);

  const updateItem = (idx: number, field: keyof ImportInvoiceItem, value: any) => {
    setItems(prev => {
      const next = [...prev];
      (next[idx] as any)[field] = value;
      if (field === 'quantity' || field === 'unit_price') {
        next[idx].total = Number(next[idx].quantity) * Number(next[idx].unit_price);
      }
      return next;
    });
  };

  const addItem = () => setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, total: 0, sort_order: prev.length }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = useMemo(() => items.reduce((s, i) => s + Number(i.total), 0), [items]);
  const rate = Number(exchangeRate) || 0;
  const grandTotal = subtotal + Number(shipping) + Number(insurance);
  const landedChargesINR = Number(customsDuty) + Number(igst) + Number(otherCharges);
  const grandTotalINR = rate > 0 ? grandTotal * rate + landedChargesINR : 0;

  const handleSubmit = () => {
    if (!invoiceNumber || !supplierId || rate <= 0) return;
    createMutation.mutate({
      invoice_number: invoiceNumber,
      supplier_id: supplierId,
      po_id: poId || null,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      currency,
      exchange_rate: rate,
      subtotal,
      shipping_charges: Number(shipping),
      insurance: Number(insurance),
      customs_duty: Number(customsDuty),
      igst_amount: Number(igst),
      other_charges: Number(otherCharges),
      grand_total: grandTotal,
      grand_total_inr: grandTotalINR,
      status: 'pending',
      bill_of_entry_number: billOfEntry || null,
      awb_bl_number: awbBl || null,
      notes: notes || null,
      items,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setInvoiceNumber('');
    setSupplierId('');
    setPoId('');
    setCurrency('USD');
    setExchangeRate('');
    setShipping('0');
    setInsurance('0');
    setCustomsDuty('0');
    setIgst('0');
    setOtherCharges('0');
    setBillOfEntry('');
    setAwbBl('');
    setNotes('');
    setItems([{ description: '', quantity: 1, unit_price: 0, total: 0, sort_order: 0 }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] grid grid-rows-[auto_1fr_auto]">
        <DialogHeader>
          <DialogTitle>Create Import Invoice</DialogTitle>
          <DialogDescription>Record an invoice from an international supplier with currency conversion.</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto space-y-6 pr-2">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier Invoice # *</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2025-001" />
            </div>
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Link to PO</Label>
              <Select value={poId} onValueChange={setPoId}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {pos.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.po_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Invoice Date</Label>
              <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Currency */}
          <Separator />
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Exchange Rate (1 {currency} = ? INR) *</Label>
              <Input type="number" step="0.01" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder="e.g. 84.15" />
            </div>
            {rate > 0 && (
              <div className="flex items-end">
                <div className="p-2 bg-muted rounded text-sm flex items-center gap-2">
                  <span>{currency} 1,000</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-medium text-primary">₹{(1000 * rate).toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Line Items */}
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">Line Items</Label>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="mr-1 h-3 w-3" /> Add</Button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 items-end">
                  <div>
                    {idx === 0 && <Label className="text-xs text-muted-foreground">Description</Label>}
                    <Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Product / description" />
                  </div>
                  <div>
                    {idx === 0 && <Label className="text-xs text-muted-foreground">Qty</Label>}
                    <Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                  </div>
                  <div>
                    {idx === 0 && <Label className="text-xs text-muted-foreground">Unit Price</Label>}
                    <Input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} />
                  </div>
                  <div>
                    {idx === 0 && <Label className="text-xs text-muted-foreground">Total</Label>}
                    <Input readOnly value={item.total.toFixed(2)} className="bg-muted" />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} disabled={items.length === 1} className="h-9 w-9">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-right mt-2 text-sm font-medium">Subtotal: {currency} {subtotal.toFixed(2)}</div>
          </div>

          {/* Import Charges */}
          <Separator />
          <div>
            <Label className="text-base font-semibold mb-3 block">Import Charges</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Shipping ({currency})</Label>
                <Input type="number" step="0.01" value={shipping} onChange={e => setShipping(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Insurance ({currency})</Label>
                <Input type="number" step="0.01" value={insurance} onChange={e => setInsurance(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Customs Duty (₹)</Label>
                <Input type="number" step="0.01" value={customsDuty} onChange={e => setCustomsDuty(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IGST (₹)</Label>
                <Input type="number" step="0.01" value={igst} onChange={e => setIgst(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Other Charges (₹)</Label>
                <Input type="number" step="0.01" value={otherCharges} onChange={e => setOtherCharges(e.target.value)} />
              </div>
            </div>
          </div>

          {/* References */}
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Bill of Entry #</Label>
              <Input value={billOfEntry} onChange={e => setBillOfEntry(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">AWB / B/L #</Label>
              <Input value={awbBl} onChange={e => setAwbBl(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          {/* Summary */}
          {rate > 0 && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Grand Total ({currency})</span>
                  <span className="font-medium">{grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>× Exchange Rate</span>
                  <span>{rate}</span>
                </div>
                <div className="flex justify-between">
                  <span>+ Landed Charges (INR)</span>
                  <span>₹{landedChargesINR.toLocaleString('en-IN')}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Total Landed Cost (INR)</span>
                  <span className="text-primary">₹{grandTotalINR.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!invoiceNumber || !supplierId || rate <= 0 || createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


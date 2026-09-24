import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useSavePurchaseBill, useSupplierOptions, type PurchaseBillItemInput } from '@/hooks/useBooks';
import { formatINR } from '@/lib/financial-statements';

const emptyItem = (): PurchaseBillItemInput => ({ description: '', hsn_code: '', quantity: 1, unit: 'Nos', rate: 0, tax_percent: 18 });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: any;
}

export function PurchaseBillDialog({ open, onOpenChange, bill }: Props) {
  const { data: suppliers = [] } = useSupplierOptions();
  const save = useSavePurchaseBill();

  const [form, setForm] = useState<any>({});
  const [items, setItems] = useState<PurchaseBillItemInput[]>([emptyItem()]);

  useEffect(() => {
    if (!open) return;
    setForm({
      bill_number: bill?.bill_number ?? '',
      bill_date: bill?.bill_date ?? new Date().toISOString().slice(0, 10),
      due_date: bill?.due_date ?? '',
      supplier_id: bill?.supplier_id ?? '',
      supplier_name: bill?.supplier_name ?? '',
      supplier_gstin: bill?.supplier_gstin ?? '',
      place_of_supply: bill?.place_of_supply ?? '',
      is_igst: bill?.is_igst ?? false,
      itc_eligible: bill?.itc_eligible ?? true,
      other_charges: bill?.other_charges ?? 0,
      notes: bill?.notes ?? '',
    });
    setItems(
      bill?.items?.length
        ? bill.items.map((i: any) => ({
            description: i.description, hsn_code: i.hsn_code ?? '', quantity: Number(i.quantity),
            unit: i.unit ?? 'Nos', rate: Number(i.rate), tax_percent: Number(i.tax_percent),
          }))
        : [emptyItem()],
    );
  }, [open, bill]);

  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));
  const setItem = (idx: number, key: keyof PurchaseBillItemInput, value: any) =>
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));

  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0), 0);
  const tax = items.reduce((s, i) => s + ((Number(i.quantity) || 0) * (Number(i.rate) || 0) * (Number(i.tax_percent) || 0)) / 100, 0);
  const total = subtotal + tax + (Number(form.other_charges) || 0);

  const onSave = async () => {
    if (!form.bill_number) return;
    const payload = { ...form, due_date: form.due_date || null, supplier_id: form.supplier_id || null };
    await save.mutateAsync({ id: bill?.id, bill: payload, items });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{bill ? 'Edit purchase bill' : 'Record purchase bill'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Bill number</Label>
            <Input value={form.bill_number ?? ''} onChange={(e) => set('bill_number', e.target.value)} placeholder="Supplier's invoice number" />
          </div>
          <div>
            <Label>Bill date</Label>
            <Input type="date" value={form.bill_date ?? ''} onChange={(e) => set('bill_date', e.target.value)} />
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={form.due_date ?? ''} onChange={(e) => set('due_date', e.target.value)} />
          </div>
          <div>
            <Label>Supplier</Label>
            <Select
              value={form.supplier_id || 'none'}
              onValueChange={(v) => {
                const s = suppliers.find((x: any) => x.id === v);
                set('supplier_id', v === 'none' ? '' : v);
                if (s) { set('supplier_name', s.name); set('supplier_gstin', s.gst_number ?? ''); }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Choose supplier" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">Not in the list</SelectItem>
                {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Supplier name (if not listed)</Label>
            <Input value={form.supplier_name ?? ''} onChange={(e) => set('supplier_name', e.target.value)} />
          </div>
          <div>
            <Label>Supplier GSTIN</Label>
            <Input value={form.supplier_gstin ?? ''} onChange={(e) => set('supplier_gstin', e.target.value.toUpperCase())} />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={!!form.is_igst} onCheckedChange={(v) => set('is_igst', v)} id="pb-igst" />
            <Label htmlFor="pb-igst">Inter-state (IGST)</Label>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={!!form.itc_eligible} onCheckedChange={(v) => set('itc_eligible', v)} id="pb-itc" />
            <Label htmlFor="pb-itc">Input credit claimable</Label>
          </div>
          <div>
            <Label>Freight / other charges</Label>
            <Input type="number" value={form.other_charges ?? 0} onChange={(e) => set('other_charges', Number(e.target.value) || 0)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Line items</Label>
            <Button size="sm" variant="outline" onClick={() => setItems((l) => [...l, emptyItem()])}>
              <Plus className="mr-1 h-4 w-4" /> Add line
            </Button>
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-4" placeholder="Description" value={it.description} onChange={(e) => setItem(idx, 'description', e.target.value)} />
              <Input className="col-span-2" placeholder="HSN" value={it.hsn_code ?? ''} onChange={(e) => setItem(idx, 'hsn_code', e.target.value)} />
              <Input className="col-span-1" type="number" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(idx, 'quantity', Number(e.target.value) || 0)} />
              <Input className="col-span-2" type="number" placeholder="Rate" value={it.rate} onChange={(e) => setItem(idx, 'rate', Number(e.target.value) || 0)} />
              <Input className="col-span-2" type="number" placeholder="GST %" value={it.tax_percent} onChange={(e) => setItem(idx, 'tax_percent', Number(e.target.value) || 0)} />
              <Button size="icon" variant="ghost" className="col-span-1" onClick={() => setItems((l) => l.filter((_, i) => i !== idx))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <div className="flex justify-end gap-6 text-sm">
          <span>Taxable: <strong>{formatINR(subtotal)}</strong></span>
          <span>GST: <strong>{formatINR(tax)}</strong></span>
          <span>Total: <strong>{formatINR(total)}</strong></span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={save.isPending || !form.bill_number}>Save bill</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

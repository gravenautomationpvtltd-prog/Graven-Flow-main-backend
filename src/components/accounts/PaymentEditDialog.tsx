import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdatePayment } from '@/hooks/usePaymentActions';

interface PaymentRow {
  id: string;
  type: 'received' | 'paid';
  amount: number;
  date: string;
  mode: string;
  reference?: string | null;
  partyName: string;
}

export function PaymentEditDialog({
  payment,
  open,
  onOpenChange,
}: {
  payment: PaymentRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const update = useUpdatePayment();
  const [form, setForm] = useState({ amount: 0, date: '', mode: 'neft', reference: '' });

  useEffect(() => {
    if (!open || !payment) return;
    setForm({
      amount: payment.amount,
      date: payment.date?.slice(0, 10) ?? '',
      mode: payment.mode || 'neft',
      reference: payment.reference ?? '',
    });
  }, [open, payment]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit payment{payment ? ` — ${payment.partyName}` : ''}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <Label>Mode</Label>
            <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['cash', 'neft', 'rtgs', 'cheque', 'upi', 'card', 'other'].map((m) => (
                  <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reference</Label>
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={update.isPending || !payment}
            onClick={async () => {
              if (!payment) return;
              await update.mutateAsync({
                id: payment.id,
                type: payment.type,
                amount: form.amount,
                payment_date: form.date,
                payment_mode: form.mode,
                transaction_reference: form.reference,
              });
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { InvoiceWithDetails, useRecordInvoicePayment } from '@/hooks/useInvoices';
import { useCreatePayment } from '@/hooks/useCustomerPayments';
import { useUpdateSalesOrder } from '@/hooks/useSalesOrders';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type PaymentMode = Database['public']['Enums']['payment_mode'];

interface RecordInvoicePaymentDialogProps {
  invoice: InvoiceWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const paymentModes = [
  { value: 'neft', label: 'NEFT' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
];

export function RecordInvoicePaymentDialog({ invoice, open, onOpenChange }: RecordInvoicePaymentDialogProps) {
  const recordPayment = useRecordInvoicePayment();
  const createPayment = useCreatePayment();
  const updateOrder = useUpdateSalesOrder();

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('neft');
  const [transactionRef, setTransactionRef] = useState('');
  const [bankName, setBankName] = useState('');
  const [notes, setNotes] = useState('');

  const balance = invoice ? invoice.grand_total - invoice.amount_paid : 0;

  useEffect(() => {
    if (open && invoice) {
      setAmount(balance.toString());
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setPaymentMode('neft');
      setTransactionRef('');
      setBankName('');
      setNotes('');
    }
  }, [open, invoice, balance]);

  const handleSubmit = async () => {
    if (!invoice || !amount) return;

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) return;

    // Record the payment on the invoice
    await recordPayment.mutateAsync({
      invoiceId: invoice.id,
      amount: paymentAmount,
    });

    // Create a proper customer payment record via the hook
    await createPayment.mutateAsync({
      customer_id: invoice.customer_id,
      amount: paymentAmount,
      payment_date: paymentDate,
      payment_mode: paymentMode,
      transaction_reference: transactionRef || undefined,
      bank_name: bankName || undefined,
      sales_order_id: invoice.sales_order_id || undefined,
      notes: notes || `Payment for Invoice ${invoice.invoice_number}`,
    });

    // Update the sales order payment status if linked
    if (invoice.sales_order_id) {
      const { data: orderData } = await supabase
        .from('sales_orders')
        .select('order_value, payment_amount')
        .eq('id', invoice.sales_order_id)
        .single();

      if (orderData) {
        const newTotalPayment = (orderData.payment_amount || 0) + paymentAmount;
        const newPaymentStatus = newTotalPayment >= (orderData.order_value || 0)
          ? 'received'
          : newTotalPayment > 0
            ? 'partial'
            : 'pending';

        await updateOrder.mutateAsync({
          id: invoice.sales_order_id,
          payment_amount: newTotalPayment,
          payment_status: newPaymentStatus,
        });
      }
    }

    onOpenChange(false);
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] grid grid-rows-[auto_1fr_auto]">
        <DialogHeader>
          <DialogTitle>Record Payment - {invoice.invoice_number}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Invoice Total:</span>
              <span>₹{Math.round(invoice.grand_total).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Already Paid:</span>
              <span>₹{Math.round(invoice.amount_paid).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Balance Due:</span>
              <span className="text-amber-600">₹{Math.round(balance).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as PaymentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentModes.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transaction Reference</Label>
              <Input
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="UTR / Cheque No."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bank Name</Label>
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Bank name"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={recordPayment.isPending || !amount || parseFloat(amount) <= 0}
          >
            {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

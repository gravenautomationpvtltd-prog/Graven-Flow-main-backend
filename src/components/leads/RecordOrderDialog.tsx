import { useState, useEffect } from 'react';
import { Upload, FileText, Receipt, Loader2, X } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuotations } from '@/hooks/useQuotations';
import { useCreateSalesOrder, useUpdateSalesOrder, useUploadOrderDocument, useNotifyProcurement, useSalesOrderByLead } from '@/hooks/useSalesOrders';
import { useUpdateLead } from '@/hooks/useLeads';
import { useCreateActivity } from '@/hooks/useActivities';
import { useCreatePayment } from '@/hooks/useCustomerPayments';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RecordOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  customerId?: string;
  customerName?: string;
}

export function RecordOrderDialog({
  open,
  onOpenChange,
  leadId,
  customerId,
  customerName,
}: RecordOrderDialogProps) {
  const [quotationId, setQuotationId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'partial' | 'received'>('pending');
  const [notes, setNotes] = useState('');
  const [customerPOFile, setCustomerPOFile] = useState<File | null>(null);
  const [paymentReceiptFile, setPaymentReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: quotations = [] } = useQuotations(leadId);
  const { data: existingOrder } = useSalesOrderByLead(leadId);
  const createSalesOrder = useCreateSalesOrder();
  const updateSalesOrder = useUpdateSalesOrder();
  const uploadDocument = useUploadOrderDocument();
  const notifyProcurement = useNotifyProcurement();
  const updateLead = useUpdateLead();
  const createActivity = useCreateActivity();
  const createPayment = useCreatePayment();

  useEffect(() => {
    if (open) {
      setQuotationId('');
      setPaymentAmount('');
      setPaymentStatus('pending');
      setNotes('');
      setCustomerPOFile(null);
      setPaymentReceiptFile(null);
    }
  }, [open]);

  const selectedQuotation = quotations.find((q) => q.id === quotationId);

  const handleSubmit = async () => {
    if (!customerPOFile) {
      toast.error('Please upload the customer PO document');
      return;
    }

    // Duplicate check
    if (existingOrder) {
      toast.error(`Order already exists for this lead (${existingOrder.order_number})`);
      return;
    }

    setIsSubmitting(true);
    const warnings: string[] = [];

    try {
      // --- STEP 1: Resolve customer_id (critical) ---
      let effectiveCustomerId = customerId;
      if (!effectiveCustomerId) {
        const { data: lead } = await supabase
          .from('leads')
          .select('customer_id')
          .eq('id', leadId)
          .single();
        effectiveCustomerId = lead?.customer_id || undefined;
      }

      if (!effectiveCustomerId) {
        toast.error('Customer not linked to this lead. Please link a customer first.');
        setIsSubmitting(false);
        return;
      }

      // --- STEP 2: Create sales order (critical) ---
      const orderValue = selectedQuotation?.grand_total ?? (parseFloat(paymentAmount) || 0);
      let order: any;
      try {
        order = await createSalesOrder.mutateAsync({
          lead_id: leadId,
          quotation_id: quotationId.length > 0 ? quotationId : undefined,
          customer_id: effectiveCustomerId,
          order_value: orderValue,
          payment_amount: parseFloat(paymentAmount) || 0,
          payment_status: paymentStatus,
          notes,
        });
      } catch (err: any) {
        console.error('Critical: Failed to create sales order', err);
        const msg = err?.code === '23505' 
          ? 'Temporary conflict creating order number. Please try again.'
          : `Failed to create order: ${err?.message || 'Unknown error'}`;
        toast.error(msg);
        setIsSubmitting(false);
        return;
      }

      // --- STEP 3: Upload customer PO (critical) ---
      try {
        await uploadDocument.mutateAsync({
          salesOrderId: order.id,
          documentType: 'customer_po',
          file: customerPOFile,
        });
      } catch (err: any) {
        console.error('Critical: Failed to upload PO', err);
        toast.error(`Order created but PO upload failed: ${err?.message || 'Unknown error'}`);
        setIsSubmitting(false);
        return;
      }

      // --- STEP 4: Update order status (critical) ---
      try {
        await updateSalesOrder.mutateAsync({
          id: order.id,
          status: 'ready_for_procurement',
        });
      } catch (err) {
        console.error('Non-blocking: Failed to update order status', err);
        warnings.push('Order status update pending');
      }

      // === SECONDARY STEPS (non-blocking) ===

      // Payment receipt upload
      if (paymentReceiptFile) {
        try {
          await uploadDocument.mutateAsync({
            salesOrderId: order.id,
            documentType: 'payment_receipt',
            file: paymentReceiptFile,
          });
        } catch (err) {
          console.error('Secondary: Payment receipt upload failed', err);
          warnings.push('Payment receipt upload failed');
        }
      }

      // Customer payment record
      const paymentAmountNum = parseFloat(paymentAmount) || 0;
      if (paymentAmountNum > 0) {
        try {
          await createPayment.mutateAsync({
            customer_id: effectiveCustomerId,
            sales_order_id: order.id,
            amount: paymentAmountNum,
            payment_date: new Date().toISOString().split('T')[0],
            payment_mode: 'neft',
            notes: `Payment recorded with order ${order.order_number}`,
          });
        } catch (err) {
          console.error('Secondary: Payment record failed', err);
          warnings.push('Payment record failed');
        }
      }

      // Mark quotation as converted
      if (quotationId) {
        try {
          await supabase
            .from('quotations')
            .update({ is_converted: true, converted_to_order_id: order.id })
            .eq('id', quotationId);
        } catch (err) {
          console.error('Secondary: Quotation conversion flag failed', err);
        }
      }

      // Update lead status to won
      try {
        await updateLead.mutateAsync({
          id: leadId,
          status: 'won',
          won_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Secondary: Lead status update failed', err);
        warnings.push('Lead status update pending');
      }

      // Create activity
      try {
        await createActivity.mutateAsync({
          lead_id: leadId,
          activity_type: 'order_received',
          description: `Customer PO received. Order ${order.order_number} created.`,
        });
      } catch (err) {
        console.error('Secondary: Activity log failed', err);
      }

      // Notify procurement
      try {
        await notifyProcurement.mutateAsync({
          salesOrderId: order.id,
          orderNumber: order.order_number,
          customerName: customerName || 'Unknown',
          orderValue: selectedQuotation?.grand_total || parseFloat(paymentAmount) || 0,
        });
      } catch (err) {
        console.error('Secondary: Procurement notification failed', err);
        warnings.push('Procurement notification failed');
      }

      // Show result
      if (warnings.length > 0) {
        toast.warning(`Order ${order.order_number} recorded with warnings: ${warnings.join(', ')}`);
      } else {
        toast.success(`Order ${order.order_number} recorded successfully! Procurement team notified.`);
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error recording order:', error);
      toast.error(`Failed to record order: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Customer Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Duplicate warning */}
          {existingOrder && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              Order <strong>{existingOrder.order_number}</strong> already exists for this lead.
            </div>
          )}

          {/* Quotation Selection */}
          <div className="space-y-2">
            <Label>Select Accepted Quotation</Label>
            <Select value={quotationId} onValueChange={setQuotationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a quotation" />
              </SelectTrigger>
              <SelectContent>
                {quotations.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.quotation_number} - ₹{q.grand_total?.toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer PO Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Customer PO Document *
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setCustomerPOFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              {customerPOFile && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setCustomerPOFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {customerPOFile && (
              <p className="text-xs text-muted-foreground">{customerPOFile.name}</p>
            )}
          </div>

          {/* Payment Receipt Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Receipt className="h-4 w-4" />
              Payment Receipt (Optional)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setPaymentReceiptFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              {paymentReceiptFile && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setPaymentReceiptFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {paymentReceiptFile && (
              <p className="text-xs text-muted-foreground">{paymentReceiptFile.name}</p>
            )}
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Amount (₹)</Label>
              <Input
                type="number"
                placeholder="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes for Procurement */}
          <div className="space-y-2">
            <Label>Notes for Procurement Team</Label>
            <Textarea
              placeholder="Any special instructions or notes for the procurement team..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !customerPOFile || !!existingOrder}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Record Order
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useRef } from 'react';
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
import { useCreatePayment, useUploadReceipt } from '@/hooks/useCustomerPayments';
import { useUpdateSalesOrder, SalesOrderWithDetails } from '@/hooks/useSalesOrders';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type PaymentMode = Database['public']['Enums']['payment_mode'];

interface OrderPaymentDialogProps {
  order: SalesOrderWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const paymentModes: { value: PaymentMode; label: string }[] = [
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export function OrderPaymentDialog({
  order,
  open,
  onOpenChange,
}: OrderPaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('neft');
  const [transactionRef, setTransactionRef] = useState('');
  const [bankName, setBankName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createPayment = useCreatePayment();
  const updateOrder = useUpdateSalesOrder();

  const pendingAmount = order ? (order.order_value || 0) - (order.payment_amount || 0) : 0;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only PDF, PNG, and JPG files are allowed');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!order || !amount || parseFloat(amount) <= 0) return;

    setIsUploading(true);
    const paymentAmount = parseFloat(amount);
    let receiptUrl: string | undefined;

    try {
      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `customer-${order.customer_id}/${order.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('payment-receipts')
          .upload(fileName, selectedFile);

        if (uploadError) {
          toast.error('Failed to upload receipt');
          setIsUploading(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('payment-receipts')
          .getPublicUrl(fileName);
        
        receiptUrl = publicUrlData.publicUrl;
      }

      // Create payment record with receipt_url
      await createPayment.mutateAsync({
        customer_id: order.customer_id!,
        amount: paymentAmount,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        transaction_reference: transactionRef || undefined,
        bank_name: bankName || undefined,
        sales_order_id: order.id,
        notes: notes || undefined,
        receipt_url: receiptUrl,
      });

      // Update order payment amount and status
      const newTotalPayment = (order.payment_amount || 0) + paymentAmount;
      const newPaymentStatus = newTotalPayment >= (order.order_value || 0) 
        ? 'received' 
        : newTotalPayment > 0 
          ? 'partial' 
          : 'pending';

      await updateOrder.mutateAsync({
        id: order.id,
        payment_amount: newTotalPayment,
        payment_status: newPaymentStatus,
      });

      // Reset form
      setAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('neft');
      setTransactionRef('');
      setBankName('');
      setNotes('');
      setSelectedFile(null);
      onOpenChange(false);
    } finally {
      setIsUploading(false);
    }
  };

  const isSubmitting = createPayment.isPending || updateOrder.isPending || isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] grid grid-rows-[auto_1fr_auto]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {order?.order_number} - {order?.customer?.company_name}
          </p>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order Value:</span>
              <span className="font-medium">₹{Math.round(order?.order_value || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Already Received:</span>
              <span className="font-medium">₹{Math.round(order?.payment_amount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-sm font-medium border-t pt-1">
              <span>Pending Amount:</span>
              <span className="text-primary">₹{Math.round(pendingAmount).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Payment Date *</Label>
              <Input
                id="date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Mode *</Label>
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
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                placeholder="HDFC, ICICI..."
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transactionRef">Transaction Reference</Label>
            <Input
              id="transactionRef"
              placeholder="UTR / Cheque No / Reference"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Payment Receipt (Optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileSelect}
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click or drag to upload receipt
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, PNG, JPG up to 5MB
                </p>
              </div>
            )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0 || isSubmitting}
          >
            {isSubmitting ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

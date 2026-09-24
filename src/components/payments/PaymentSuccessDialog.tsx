import { CheckCircle2, Download, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { downloadPaymentReceipt, type PaymentReceiptData } from './generatePaymentReceipt';

interface PaymentSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptData: PaymentReceiptData | null;
  onContinue?: () => void;
}

export function PaymentSuccessDialog({
  open,
  onOpenChange,
  receiptData,
  onContinue,
}: PaymentSuccessDialogProps) {
  const handleDownload = () => {
    if (receiptData) {
      downloadPaymentReceipt(receiptData);
    }
  };

  const handleContinue = () => {
    onOpenChange(false);
    onContinue?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader className="items-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="h-9 w-9 text-green-600" />
          </div>
          <DialogTitle className="text-xl">Payment Successful!</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {receiptData && (
            <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold text-foreground">₹{receiptData.totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="text-foreground capitalize">{receiptData.planType.replace('_', '-')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment ID</span>
                <span className="text-foreground font-mono text-xs">{receiptData.paymentId}</span>
              </div>
            </div>
          )}

          <Button onClick={handleDownload} variant="outline" className="w-full gap-2">
            <Download className="h-4 w-4" />
            Download Receipt (PDF)
          </Button>

          <Button onClick={handleContinue} className="w-full">
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

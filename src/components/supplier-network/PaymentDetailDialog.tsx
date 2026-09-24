import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  IndianRupee, 
  Calendar, 
  CreditCard, 
  Building2, 
  User, 
  FileText,
  Download,
  ExternalLink,
  Hash,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';

interface PaymentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: {
    id: string;
    payment_date: string;
    amount: number;
    payment_mode: string;
    transaction_reference?: string | null;
    bank_name?: string | null;
    notes?: string | null;
    receipt_url?: string | null;
    po?: { po_number?: string; id?: string } | null;
    paid_by_profile?: { full_name?: string } | null;
  } | null;
  onNavigateToPO?: (poId: string) => void;
}

export function PaymentDetailDialog({ 
  open, 
  onOpenChange, 
  payment,
  onNavigateToPO 
}: PaymentDetailDialogProps) {
  if (!payment) return null;

  const getPaymentModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      bank_transfer: 'Bank Transfer',
      neft: 'NEFT',
      rtgs: 'RTGS',
      imps: 'IMPS',
      cheque: 'Cheque',
      cash: 'Cash',
      upi: 'UPI',
    };
    return labels[mode] || mode;
  };

  const getPaymentModeColor = (mode: string) => {
    switch (mode) {
      case 'bank_transfer':
      case 'neft':
      case 'rtgs':
      case 'imps':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'cheque':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      case 'cash':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'upi':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${payment.id}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-primary" />
            Payment Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Amount Section */}
          <div className="text-center py-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <p className="text-sm text-muted-foreground mb-1">Amount Paid</p>
            <p className="text-3xl font-bold text-green-600">
              ₹{payment.amount.toLocaleString('en-IN')}
            </p>
          </div>

          <Separator />

          {/* Details Grid */}
          <div className="grid gap-4">
            {/* Payment Date */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Date</p>
                <p className="font-medium">
                  {format(new Date(payment.payment_date), 'dd MMMM yyyy')}
                </p>
              </div>
            </div>

            {/* Payment Mode */}
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Mode</p>
                <Badge className={`mt-1 ${getPaymentModeColor(payment.payment_mode)}`}>
                  {getPaymentModeLabel(payment.payment_mode)}
                </Badge>
              </div>
            </div>

            {/* Transaction Reference */}
            {payment.transaction_reference && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Transaction Reference</p>
                  <p className="font-mono text-sm font-medium">
                    {payment.transaction_reference}
                  </p>
                </div>
              </div>
            )}

            {/* Bank Name */}
            {payment.bank_name && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bank</p>
                  <p className="font-medium">{payment.bank_name}</p>
                </div>
              </div>
            )}

            {/* Paid By */}
            {(payment.paid_by_profile as any)?.full_name && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid By</p>
                  <p className="font-medium">{(payment.paid_by_profile as any).full_name}</p>
                </div>
              </div>
            )}

            {/* PO Number */}
            {(payment.po as any)?.po_number && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Purchase Order</p>
                  <Badge 
                    variant="outline" 
                    className="mt-1 font-mono cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => {
                      if (onNavigateToPO && (payment.po as any)?.id) {
                        onNavigateToPO((payment.po as any).id);
                      }
                    }}
                  >
                    {(payment.po as any).po_number}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Badge>
                </div>
              </div>
            )}

            {/* Notes */}
            {payment.notes && (
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm mt-1">{payment.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Receipt Section */}
          {payment.receipt_url && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">Receipt</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => handleDownload(payment.receipt_url!)}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => window.open(payment.receipt_url!, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    View
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { normalizePhone } from '@/lib/phone-utils';

interface CallQRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  customerName?: string;
  onLogActivity: () => void;
}

export function CallQRCodeDialog({ 
  open, 
  onOpenChange, 
  phoneNumber, 
  customerName, 
  onLogActivity 
}: CallQRCodeDialogProps) {
  // Normalize to 10-digit number (QR encodes only digits)
  const mobileNumber = normalizePhone(phoneNumber);
  const displayNumber = mobileNumber.length === 10 ? mobileNumber : phoneNumber;
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(mobileNumber);
    toast.success('Phone number copied!');
  };
  
  const handleLogActivity = () => {
    onLogActivity();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Call {customerName || 'Customer'}</DialogTitle>
          <DialogDescription>
            Scan the QR code with your phone to call this number
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4 py-4">
          {/* Phone Number Display */}
          <div className="text-2xl font-bold text-primary">
            {displayNumber}
          </div>
          
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg border">
            <QRCodeSVG value={mobileNumber} size={180} />
          </div>
          
          {/* Instructions */}
          <p className="text-sm text-muted-foreground text-center">
            Scan with your phone to call
          </p>
          
          {/* Action Buttons */}
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={copyToClipboard} className="flex-1">
              <Copy className="h-4 w-4 mr-2" />
              Copy Number
            </Button>
            <Button onClick={handleLogActivity} className="flex-1">
              <CheckCircle className="h-4 w-4 mr-2" />
              Log Activity
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

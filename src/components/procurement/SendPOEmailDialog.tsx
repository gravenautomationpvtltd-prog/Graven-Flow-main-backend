import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePurchaseOrder } from '@/hooks/usePurchaseOrders';

interface SendPOEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string | null;
}

export function SendPOEmailDialog({ open, onOpenChange, poId }: SendPOEmailDialogProps) {
  const { data: po } = usePurchaseOrder(poId ?? undefined);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Pre-fill with supplier email
  useState(() => {
    if (po?.supplier?.email) {
      setRecipientEmail(po.supplier.email);
      setRecipientName(po.supplier.contact_person || po.supplier.name);
    }
  });

  const handleSend = async () => {
    if (!po || !recipientEmail) return;

    setIsSending(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke('send-po-email', {
        body: {
          po_id: po.id,
          recipient_email: recipientEmail,
          recipient_name: recipientName || undefined,
          message: message || undefined,
          cc: ccEmails ? ccEmails.split(',').map(e => e.trim()).filter(Boolean) : undefined,
          user_id: userData.user?.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to send email');

      toast.success('Purchase order sent to supplier successfully');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending PO email:', error);
      toast.error(error.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  if (!po) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send PO to Supplier
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="font-medium">{po.po_number}</p>
            <p className="text-muted-foreground">{po.supplier?.name}</p>
            <p className="text-muted-foreground">Total: ₹{po.grand_total.toFixed(2)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient-email">Recipient Email *</Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder="supplier@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient-name">Recipient Name</Label>
            <Input
              id="recipient-name"
              placeholder="Contact Person"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc-emails">CC (comma separated)</Label>
            <Input
              id="cc-emails"
              placeholder="cc1@example.com, cc2@example.com"
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Additional Message</Label>
            <Textarea
              id="message"
              placeholder="Any additional message for the supplier..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !recipientEmail}>
            <Send className="mr-2 h-4 w-4" />
            {isSending ? 'Sending...' : 'Send PO'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

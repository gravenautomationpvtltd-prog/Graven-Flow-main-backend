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
import { Textarea } from '@/components/ui/textarea';
import { InvoiceWithDetails, useUpdateInvoice } from '@/hooks/useInvoices';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useTenantBranding } from '@/hooks/useTenantBranding';

interface SendInvoiceEmailDialogProps {
  invoice: InvoiceWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendInvoiceEmailDialog({ invoice, open, onOpenChange }: SendInvoiceEmailDialogProps) {
  const { user } = useAuth();
  const { branding } = useTenantBranding();
  const updateInvoice = useUpdateInvoice();
  const [sending, setSending] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open && invoice) {
      setRecipientEmail(invoice.customer?.email || '');
      setSubject(`Invoice ${invoice.invoice_number} from ${branding.companyName}`);
      setMessage(
        `Dear ${invoice.customer?.contact_person || invoice.customer?.company_name || 'Customer'},\n\n` +
        `Please find attached Invoice ${invoice.invoice_number} for ₹${invoice.grand_total.toLocaleString('en-IN')}.\n\n` +
        `${invoice.due_date ? `Payment is due by ${new Date(invoice.due_date).toLocaleDateString('en-IN')}.\n\n` : ''}` +
        `If you have any questions regarding this invoice, please don't hesitate to contact us.\n\n` +
        `Best regards,\n` +
        branding.companyName
      );
      setCcEmails('');
    }
  }, [open, invoice]);

  const handleSend = async () => {
    if (!invoice || !recipientEmail) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          invoiceId: invoice.id,
          recipientEmail,
          ccEmails: ccEmails.split(',').map(e => e.trim()).filter(Boolean),
          subject,
          message,
        },
      });

      if (error) throw error;

      // Update invoice status
      await updateInvoice.mutateAsync({
        id: invoice.id,
        invoice: {
          status: invoice.status === 'draft' ? 'sent' : invoice.status,
          sent_at: new Date().toISOString(),
          sent_by: user?.id,
        },
      });

      toast.success('Invoice sent successfully');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Failed to send invoice: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Invoice {invoice.invoice_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>To *</Label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label>CC (comma separated)</Label>
            <Input
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              placeholder="cc1@example.com, cc2@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
            />
          </div>

          <div className="text-sm text-muted-foreground">
            The invoice PDF will be attached automatically.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !recipientEmail}>
            {sending ? 'Sending...' : 'Send Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

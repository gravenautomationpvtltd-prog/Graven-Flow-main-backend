import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEnquiryTemplate } from '@/hooks/useCustomerOutreach';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type Customer = Database['public']['Tables']['customers']['Row'];

interface SendEnquiryEmailDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendEnquiryEmailDialog({ customer, open, onOpenChange }: SendEnquiryEmailDialogProps) {
  const { data: emailTemplate } = useEnquiryTemplate('email');
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Initialize form with template when dialog opens
  useEffect(() => {
    if (open && customer) {
      const customerName = customer.contact_person || customer.company_name;
      
      let defaultSubject = 'Enquiry for Automation Products';
      let defaultBody = `Hello ${customerName},\n\nWe wanted to reach out and check if you have any requirements for automation products.\n\nPlease let us know if you need any assistance.\n\nBest regards,\nMKS Automation`;
      
      if (emailTemplate) {
        if (emailTemplate.subject) {
          defaultSubject = emailTemplate.subject.replace(/\{\{customer_name\}\}/g, customerName);
        }
        if (emailTemplate.body) {
          defaultBody = emailTemplate.body.replace(/\{\{customer_name\}\}/g, customerName);
        }
      }
      
      setSubject(defaultSubject);
      setBody(defaultBody);
      setCcEmails('');
    }
  }, [open, customer, emailTemplate]);

  const handleSend = async () => {
    if (!customer?.email) {
      toast.error('Customer email is required');
      return;
    }

    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and message are required');
      return;
    }

    setIsSending(true);
    try {
      const ccArray = ccEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const { data, error } = await supabase.functions.invoke('send-enquiry-email', {
        body: {
          customer_id: customer.id,
          customer_email: customer.email,
          customer_name: customer.contact_person || customer.company_name,
          subject: subject.trim(),
          body: body.trim(),
          cc: ccArray,
          user_id: user?.id,
        },
      });

      if (error) throw error;

      toast.success('Email sent successfully');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to send email:', error);
      toast.error(error.message || 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Enquiry Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">To</Label>
            <div className="p-3 bg-muted rounded-md text-sm">
              {customer.email} ({customer.contact_person || customer.company_name})
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc">CC (comma separated)</Label>
            <Input
              id="cc"
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              placeholder="sales@company.com, manager@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email message"
              rows={8}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

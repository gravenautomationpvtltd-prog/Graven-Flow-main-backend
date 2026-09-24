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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Mail, Paperclip } from 'lucide-react';
import { useDispatchDocuments } from '@/hooks/useDispatchDocuments';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import type { Database } from '@/integrations/supabase/types';

type DispatchDocumentType = Database['public']['Enums']['dispatch_document_type'];

interface SendDispatchEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatchId: string;
  dispatchNumber: string;
  customerEmail: string | null;
  customerName: string;
}

const documentTypeLabels: Record<DispatchDocumentType, string> = {
  invoice: 'Tax Invoice',
  eway_bill: 'E-Way Bill',
  awb: 'AWB / Docket',
  packing_list: 'Packing List',
  other: 'Other Document',
};

export function SendDispatchEmailDialog({
  open,
  onOpenChange,
  dispatchId,
  dispatchNumber,
  customerEmail,
  customerName,
}: SendDispatchEmailDialogProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const { branding } = useTenantBranding();

  const { data: documents } = useDispatchDocuments(dispatchId);

  useEffect(() => {
    if (open) {
      setRecipientEmail(customerEmail || '');
      setSubject(`Dispatch Documents - ${dispatchNumber}`);
      setMessage(`Dear ${customerName},\n\nPlease find attached the dispatch documents for your order.\n\nDispatch Number: ${dispatchNumber}\n\nThank you for your business.\n\nBest regards,\n${branding.companyName}`);
      setSelectedDocs(documents?.map(d => d.id) || []);
    }
  }, [open, customerEmail, dispatchNumber, customerName, documents]);

  const toggleDocument = (docId: string) => {
    setSelectedDocs(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSend = async () => {
    if (!recipientEmail) {
      toast({ title: 'Please enter recipient email', variant: 'destructive' });
      return;
    }

    if (selectedDocs.length === 0) {
      toast({ title: 'Please select at least one document', variant: 'destructive' });
      return;
    }

    setIsSending(true);

    try {
      const selectedDocuments = documents?.filter(d => selectedDocs.includes(d.id)) || [];
      
      const { error } = await supabase.functions.invoke('send-dispatch-email', {
        body: {
          recipientEmail,
          ccEmails: ccEmails.split(',').map(e => e.trim()).filter(Boolean),
          subject,
          message,
          dispatchNumber,
          documents: selectedDocuments.map(d => ({
            name: d.file_name,
            url: d.file_url,
            type: d.document_type,
          })),
        },
      });

      if (error) throw error;

      toast({ title: 'Email sent successfully' });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Failed to send email',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Dispatch Documents
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="email">Recipient Email *</Label>
            <Input
              id="email"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc">CC (comma separated)</Label>
            <Input
              id="cc"
              type="text"
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              placeholder="cc1@example.com, cc2@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
            />
          </div>

          {documents && documents.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments
              </Label>
              <div className="space-y-2 border rounded-lg p-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2">
                    <Checkbox
                      id={doc.id}
                      checked={selectedDocs.includes(doc.id)}
                      onCheckedChange={() => toggleDocument(doc.id)}
                    />
                    <label
                      htmlFor={doc.id}
                      className="text-sm flex-1 cursor-pointer flex items-center gap-2"
                    >
                      {doc.file_name}
                      <Badge variant="secondary" className="text-xs">
                        {documentTypeLabels[doc.document_type]}
                      </Badge>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!documents || documents.length === 0) && (
            <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
              No documents uploaded. Please upload documents first.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !recipientEmail || selectedDocs.length === 0}
          >
            {isSending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

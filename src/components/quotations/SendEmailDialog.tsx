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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, Plus, X, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientEmail: string;
  recipientName?: string;
  quotationNumber: string;
  quotationSubject?: string;
  quotationValidUntil?: string;
  quotationGrandTotal?: number;
  quotationDeliveryTimeline?: string;
  senderName?: string;
  senderPhone?: string;
  senderEmail?: string;
  onSend: (params: {
    recipient_email: string;
    recipient_name?: string;
    message?: string;
    cc?: string[];
    bcc?: string[];
    reply_to?: string;
    subject?: string;
  }) => void;
  isSending?: boolean;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  recipientEmail,
  recipientName,
  quotationNumber,
  quotationSubject,
  quotationValidUntil,
  quotationGrandTotal,
  quotationDeliveryTimeline,
  senderName,
  senderPhone,
  senderEmail,
  onSend,
  isSending = false,
}: SendEmailDialogProps) {
  const { data: templates } = useEmailTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState('sales@gravenautomation.com');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);

  // Apply template variables - supports both PascalCase and snake_case
  const applyTemplateVariables = (text: string) => {
    const amount = quotationGrandTotal?.toLocaleString('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 0 
    }) || '₹0';
    const deliveryTimeline = quotationDeliveryTimeline || '2-3 Weeks';
    const validityPeriod = quotationValidUntil || '15 Days';
    const phone = senderPhone || '7905350134';
    const email = senderEmail || 'sales@gravenautomation.com';
    const salesperson = senderName || 'Sales Team';
    const customer = recipientName || 'Customer';

    return text
      // PascalCase versions (from email templates)
      .replace(/\{\{Client_Name\}\}/gi, customer)
      .replace(/\{\{Quotation_Number\}\}/gi, quotationNumber)
      .replace(/\{\{Amount\}\}/gi, amount)
      .replace(/\{\{Delivery_Timeline\}\}/gi, deliveryTimeline)
      .replace(/\{\{Validity_Period\}\}/gi, validityPeriod)
      .replace(/\{\{Sales_Person_Name\}\}/gi, salesperson)
      .replace(/\{\{Phone\}\}/gi, phone)
      .replace(/\{\{Email\}\}/gi, email)
      // snake_case versions (backward compatibility)
      .replace(/\{\{customer_name\}\}/gi, customer)
      .replace(/\{\{quotation_number\}\}/gi, quotationNumber)
      .replace(/\{\{subject\}\}/gi, quotationSubject || '')
      .replace(/\{\{valid_until\}\}/gi, validityPeriod)
      .replace(/\{\{grand_total\}\}/gi, amount)
      .replace(/\{\{sender_name\}\}/gi, salesperson)
      .replace(/\{\{delivery_timeline\}\}/gi, deliveryTimeline)
      .replace(/\{\{phone\}\}/gi, phone)
      .replace(/\{\{email\}\}/gi, email);
  };

  // Set default template on open
  useEffect(() => {
    if (open && templates?.length) {
      const defaultTemplate = templates.find((t) => t.is_default) || templates[0];
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
        setSubject(applyTemplateVariables(defaultTemplate.subject));
        setMessage(applyTemplateVariables(defaultTemplate.body));
      }
    }
  }, [open, templates, quotationNumber, recipientName, quotationSubject, quotationValidUntil, quotationGrandTotal, senderName]);

  // Handle template change
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates?.find((t) => t.id === templateId);
    if (template) {
      setSubject(applyTemplateVariables(template.subject));
      setMessage(applyTemplateVariables(template.body));
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const addCcEmail = () => {
    const email = ccInput.trim();
    if (email && validateEmail(email) && !ccEmails.includes(email)) {
      setCcEmails([...ccEmails, email]);
      setCcInput('');
    }
  };

  const addBccEmail = () => {
    const email = bccInput.trim();
    if (email && validateEmail(email) && !bccEmails.includes(email)) {
      setBccEmails([...bccEmails, email]);
      setBccInput('');
    }
  };

  const removeCcEmail = (email: string) => {
    setCcEmails(ccEmails.filter((e) => e !== email));
  };

  const removeBccEmail = (email: string) => {
    setBccEmails(bccEmails.filter((e) => e !== email));
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    type: 'cc' | 'bcc'
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'cc') {
        addCcEmail();
      } else {
        addBccEmail();
      }
    }
  };

  const handleSend = () => {
    onSend({
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      message: message || undefined,
      cc: ccEmails.length > 0 ? ccEmails : undefined,
      bcc: bccEmails.length > 0 ? bccEmails : undefined,
      reply_to: replyTo.trim() && validateEmail(replyTo) ? replyTo.trim() : undefined,
      subject: subject.trim() || undefined,
    });
  };

  const handleClose = () => {
    setSelectedTemplateId('');
    setSubject('');
    setMessage('');
    setReplyTo('sales@gravenautomation.com');
    setCcInput('');
    setBccInput('');
    setCcEmails([]);
    setBccEmails([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Send Quotation via Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Selection */}
          {templates && templates.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Email Template
              </Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.is_default && ' (Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Primary Recipient */}
          <div className="space-y-2">
            <Label>To</Label>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{recipientEmail}</span>
              {recipientName && (
                <span className="text-sm text-muted-foreground">
                  ({recipientName})
                </span>
              )}
            </div>
          </div>

          {/* Subject Field */}
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              placeholder="Enter email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Reply-To Field */}
          <div className="space-y-2">
            <Label>Reply-To</Label>
            <Input
              placeholder="Enter reply-to email address"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Customer replies will be sent to this email address
            </p>
          </div>

          {/* CC Field */}
          <div className="space-y-2">
            <Label>CC (optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter email address"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'cc')}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addCcEmail}
                disabled={!ccInput.trim() || !validateEmail(ccInput)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {ccEmails.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {ccEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => removeCcEmail(email)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* BCC Field */}
          <div className="space-y-2">
            <Label>BCC (optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter email address"
                value={bccInput}
                onChange={(e) => setBccInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'bcc')}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addBccEmail}
                disabled={!bccInput.trim() || !validateEmail(bccInput)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {bccEmails.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {bccEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => removeBccEmail(email)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Email Body */}
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Enter email message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          {/* Quotation Info */}
          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
            Sending quotation <strong>{quotationNumber}</strong> with PDF attachment.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !subject.trim()}>
            {isSending ? (
              <>Sending...</>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

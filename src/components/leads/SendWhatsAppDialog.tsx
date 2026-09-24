import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';
import { MessageCircle, Send, Plus, X } from 'lucide-react';

interface SendWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  customerPhone?: string | null;
  customerName?: string;
}

// Common template options - these should match your AiSensy approved templates
const templateOptions = [
  { value: 'welcome_message', label: 'Welcome Message' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'quotation_sent', label: 'Quotation Sent' },
  { value: 'order_confirmation', label: 'Order Confirmation' },
  { value: 'payment_reminder', label: 'Payment Reminder' },
  { value: 'custom', label: 'Custom Template' },
];

export function SendWhatsAppDialog({
  open,
  onOpenChange,
  leadId,
  customerPhone,
  customerName,
}: SendWhatsAppDialogProps) {
  const sendWhatsApp = useSendWhatsApp();
  const [template, setTemplate] = useState('');
  const [customTemplate, setCustomTemplate] = useState('');
  const [params, setParams] = useState<string[]>(['']);

  const handleAddParam = () => {
    setParams([...params, '']);
  };

  const handleRemoveParam = (index: number) => {
    setParams(params.filter((_, i) => i !== index));
  };

  const handleParamChange = (index: number, value: string) => {
    const newParams = [...params];
    newParams[index] = value;
    setParams(newParams);
  };

  const handleSend = async () => {
    if (!customerPhone) return;

    const templateName = template === 'custom' ? customTemplate : template;
    if (!templateName) return;

    await sendWhatsApp.mutateAsync({
      destination: customerPhone,
      templateName,
      templateParams: {
        userName: customerName || 'Customer',
        params: params.filter(p => p.trim() !== ''),
      },
      leadId,
    });

    onOpenChange(false);
    setTemplate('');
    setCustomTemplate('');
    setParams(['']);
  };

  const canSend = customerPhone && (template === 'custom' ? customTemplate : template);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Send WhatsApp Message
          </DialogTitle>
          <DialogDescription>
            Send a template message via WhatsApp Business API
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Recipient</Label>
            <Input
              value={customerPhone || 'No phone number'}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templateOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {template === 'custom' && (
            <div className="space-y-2">
              <Label>Custom Template Name</Label>
              <Input
                placeholder="Enter template name from AiSensy"
                value={customTemplate}
                onChange={(e) => setCustomTemplate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the exact template name as configured in your AiSensy dashboard
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Template Parameters</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddParam}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {params.map((param, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Parameter ${index + 1}`}
                    value={param}
                    onChange={(e) => handleParamChange(index, e.target.value)}
                  />
                  {params.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveParam(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Add values for template placeholders like {'{1}'}, {'{2}'}, etc.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={!canSend || sendWhatsApp.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {sendWhatsApp.isPending ? (
              'Sending...'
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

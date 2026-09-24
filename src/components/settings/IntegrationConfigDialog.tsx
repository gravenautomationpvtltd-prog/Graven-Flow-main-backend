import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateIntegration, IntegrationType, IntegrationSetting } from "@/hooks/useIntegrations";
import { Eye, EyeOff, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface IntegrationConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationType: IntegrationType;
  currentSettings?: IntegrationSetting;
}

const integrationFields: Record<IntegrationType, {
  title: string;
  description: string;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'password' | 'select';
    placeholder?: string;
    options?: { value: string; label: string }[];
    helpText?: string;
  }[];
  webhookUrl?: boolean;
  docsUrl?: string;
}> = {
  indiamart: {
    title: 'IndiaMART Configuration',
    description: 'Enter your IndiaMART CRM API key to automatically fetch leads',
    fields: [
      {
        key: 'api_key',
        label: 'CRM API Key',
        type: 'password',
        placeholder: 'Enter your IndiaMART CRM key',
        helpText: 'Get this from IndiaMART Seller Dashboard → Lead Manager → CRM Settings',
      },
    ],
    docsUrl: 'https://seller.indiamart.com/leadmanager/',
  },
  whatsapp: {
    title: 'WhatsApp Configuration',
    description: 'Configure WhatsApp Business API to receive leads from WhatsApp',
    fields: [
      {
        key: 'provider',
        label: 'Provider',
        type: 'select',
        options: [
          { value: '360dialog', label: '360Dialog' },
          { value: 'gupshup', label: 'Gupshup' },
          { value: 'wati', label: 'Wati' },
          { value: 'aisensy', label: 'AiSensy' },
        ],
      },
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'Enter your WhatsApp API key',
      },
    ],
    webhookUrl: true,
  },
  justdial: {
    title: 'JustDial Configuration',
    description: 'Configure webhook to receive leads from JustDial',
    fields: [
      {
        key: 'api_key',
        label: 'Webhook Secret',
        type: 'password',
        placeholder: 'Enter a secret key for webhook verification',
        helpText: 'Use this to verify incoming webhooks from JustDial',
      },
    ],
    webhookUrl: true,
  },
  tradeindia: {
    title: 'TradeIndia Configuration',
    description: 'Configure webhook to receive leads from TradeIndia',
    fields: [
      {
        key: 'api_key',
        label: 'Webhook Secret',
        type: 'password',
        placeholder: 'Enter a secret key for webhook verification',
        helpText: 'Use this to verify incoming webhooks from TradeIndia',
      },
    ],
    webhookUrl: true,
  },
  email: {
    title: 'Email Configuration',
    description: 'Configure email forwarding to create leads from emails',
    fields: [
      {
        key: 'forward_email',
        label: 'Forwarding Email',
        type: 'text',
        placeholder: 'leads@your-domain.com',
        helpText: 'Forward inquiry emails to this address',
      },
    ],
  },
};

export function IntegrationConfigDialog({
  open,
  onOpenChange,
  integrationType,
  currentSettings,
}: IntegrationConfigDialogProps) {
  const config = integrationFields[integrationType];
  const updateIntegration = useUpdateIntegration();
  
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (currentSettings) {
      const data: Record<string, string> = {};
      data.api_key = currentSettings.api_key || '';
      data.api_secret = currentSettings.api_secret || '';
      
      // Load config fields
      if (currentSettings.config) {
        Object.entries(currentSettings.config).forEach(([key, value]) => {
          data[key] = String(value);
        });
      }
      
      setFormData(data);
    } else {
      setFormData({});
    }
  }, [currentSettings, open]);

  const handleSave = async () => {
    const updates: Partial<IntegrationSetting> = {
      api_key: formData.api_key || null,
      api_secret: formData.api_secret || null,
      config: {},
    };

    // Build config object from non-api fields
    config.fields.forEach(field => {
      if (field.key !== 'api_key' && field.key !== 'api_secret' && formData[field.key]) {
        (updates.config as Record<string, any>)[field.key] = formData[field.key];
      }
    });

    await updateIntegration.mutateAsync({
      integrationType,
      updates,
    });

    onOpenChange(false);
  };

  const webhookUrl = config.webhookUrl
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${integrationType === 'whatsapp' ? 'whatsapp-webhook' : 'lead-webhook'}`
    : null;

  const copyWebhookUrl = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      toast.success('Webhook URL copied to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {config.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              
              {field.type === 'select' ? (
                <Select
                  value={formData[field.key] || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, [field.key]: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="relative">
                  <Input
                    id={field.key}
                    type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className={field.type === 'password' ? 'pr-10' : ''}
                  />
                  {field.type === 'password' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                    >
                      {showSecrets[field.key] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              )}
              
              {field.helpText && (
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
              )}
            </div>
          ))}

          {webhookUrl && (
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this URL in your {integrationType} dashboard to receive leads
              </p>
            </div>
          )}

          {config.docsUrl && (
            <a
              href={config.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View documentation
            </a>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateIntegration.isPending}>
            {updateIntegration.isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { Switch } from '@/components/ui/switch';
import { WhatsAppTemplate } from '@/hooks/useWhatsAppTemplates';

interface WhatsAppTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: WhatsAppTemplate | null;
  onSave: (data: {
    name: string;
    campaign_name: string;
    description?: string;
    is_default?: boolean;
    is_active?: boolean;
  }) => void;
  isLoading?: boolean;
}

export function WhatsAppTemplateDialog({
  open,
  onOpenChange,
  template,
  onSave,
  isLoading,
}: WhatsAppTemplateDialogProps) {
  const [name, setName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setCampaignName(template.campaign_name);
      setDescription(template.description || '');
      setIsDefault(template.is_default);
      setIsActive(template.is_active);
    } else {
      setName('');
      setCampaignName('');
      setDescription('');
      setIsDefault(false);
      setIsActive(true);
    }
  }, [template, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      campaign_name: campaignName,
      description: description || undefined,
      is_default: isDefault,
      is_active: isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit WhatsApp Template' : 'Add WhatsApp Template'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Marketing Template"
              required
            />
            <p className="text-xs text-muted-foreground">
              A friendly name to identify this template
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaignName">AiSensy Campaign Name</Label>
            <Input
              id="campaignName"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., marketing_english_19_12_2025_5726"
              required
            />
            <p className="text-xs text-muted-foreground">
              The exact campaign name from AiSensy dashboard
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe when to use this template..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isDefault">Default Template</Label>
              <p className="text-xs text-muted-foreground">
                Use this template by default for outreach
              </p>
            </div>
            <Switch
              id="isDefault"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive templates won't appear in selection
              </p>
            </div>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name || !campaignName}>
              {isLoading ? 'Saving...' : template ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

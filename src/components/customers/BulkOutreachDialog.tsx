import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, MessageCircle, Mail } from 'lucide-react';
import { useTriggerOutreach } from '@/hooks/useCustomerOutreach';
import { Checkbox } from '@/components/ui/checkbox';

interface BulkOutreachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retargetableCount?: number;
}

export function BulkOutreachDialog({ open, onOpenChange, retargetableCount }: BulkOutreachDialogProps) {
  const [batchSize, setBatchSize] = useState('50');
  const [daysGap, setDaysGap] = useState('30');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const triggerOutreach = useTriggerOutreach();

  const channels: ('email' | 'whatsapp')[] = [];
  if (sendEmail) channels.push('email');
  if (sendWhatsapp) channels.push('whatsapp');

  const handleSend = async () => {
    if (channels.length === 0) return;
    
    await triggerOutreach.mutateAsync({
      batchSize: parseInt(batchSize),
      channels,
      daysGap: parseInt(daysGap),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retarget Customers</DialogTitle>
          <DialogDescription>
            Send outreach to customers who haven't been contacted recently.
            {retargetableCount !== undefined && (
              <span className="block mt-1 font-medium text-foreground">
                {retargetableCount.toLocaleString()} customers eligible for retargeting
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Don't contact if reached within (days)</Label>
            <Select value={daysGap} onValueChange={setDaysGap}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Batch size</Label>
            <Input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              min={1}
              max={500}
            />
          </div>

          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={sendEmail} onCheckedChange={(c) => setSendEmail(!!c)} />
                <Mail className="h-4 w-4" />
                <span className="text-sm">Email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={sendWhatsapp} onCheckedChange={(c) => setSendWhatsapp(!!c)} />
                <MessageCircle className="h-4 w-4" />
                <span className="text-sm">WhatsApp</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={channels.length === 0 || triggerOutreach.isPending}
          >
            {triggerOutreach.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {triggerOutreach.isPending ? 'Sending...' : `Send to ${batchSize} customers`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

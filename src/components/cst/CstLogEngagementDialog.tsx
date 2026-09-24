import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useLogEngagement, type CstChannel, type CstOutcome } from '@/hooks/useCstEngagements';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: string;
  customerName: string;
  defaultChannel?: CstChannel;
}

const CHANNELS: { value: CstChannel; label: string }[] = [
  { value: 'call', label: 'Phone call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
];

const OUTCOMES: { value: CstOutcome; label: string }[] = [
  { value: 'connected', label: 'Connected' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'interested', label: 'Interested' },
  { value: 'order_promise', label: 'Promised order' },
  { value: 'info_shared', label: 'Info shared' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'do_not_contact', label: 'Do not contact' },
  { value: 'other', label: 'Other' },
];

export function CstLogEngagementDialog({ open, onOpenChange, customerId, customerName, defaultChannel = 'call' }: Props) {
  const log = useLogEngagement();
  const [channel, setChannel] = useState<CstChannel>(defaultChannel);
  const [outcome, setOutcome] = useState<CstOutcome>('connected');
  const [summary, setSummary] = useState('');
  const [nextAt, setNextAt] = useState('');
  const [nextType, setNextType] = useState('follow_up');

  const reset = () => {
    setChannel(defaultChannel); setOutcome('connected'); setSummary(''); setNextAt(''); setNextType('follow_up');
  };

  const submit = async () => {
    await log.mutateAsync({
      customer_id: customerId,
      channel, outcome, summary: summary.trim() || null,
      next_action_at: nextAt ? new Date(nextAt).toISOString() : null,
      next_action_type: nextAt ? nextType : null,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log touch — {customerName}</DialogTitle>
          <DialogDescription>Track this contact so nothing slips through the cracks.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as CstChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as CstOutcome)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Summary</Label>
            <Textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
              placeholder="What happened? Any commitments made?" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Next action</Label>
              <Input type="datetime-local" value={nextAt} onChange={e => setNextAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={nextType} onValueChange={setNextType} disabled={!nextAt}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up">Follow-up call</SelectItem>
                  <SelectItem value="send_quote">Send quotation</SelectItem>
                  <SelectItem value="send_info">Send info</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={log.isPending}>
            {log.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Log touch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

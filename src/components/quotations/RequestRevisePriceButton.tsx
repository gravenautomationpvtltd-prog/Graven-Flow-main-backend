import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Target } from 'lucide-react';
import { useRequestPriceRevision } from '@/hooks/useRequestPriceRevision';

interface Props {
  itemLabel: string;
  productId?: string | null;
  validUntil?: string | null;
  quantity?: number | null;
  defaultTargetRate?: number | null;
  leadId?: string | null;
  className?: string;
}

/**
 * Shown to sales when a catalog price validity has lapsed — creates a
 * procurement task asking for a target / revised price.
 */
export function RequestRevisePriceButton({
  itemLabel,
  productId,
  validUntil,
  quantity,
  defaultTargetRate,
  leadId,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(defaultTargetRate ? String(defaultTargetRate) : '');
  const [notes, setNotes] = useState('');
  const { mutateAsync, isPending } = useRequestPriceRevision();

  const submit = async () => {
    await mutateAsync({
      itemLabel,
      productId,
      validUntil,
      quantity,
      targetRate: target ? parseFloat(target) : null,
      notes: notes || null,
      leadId,
    });
    setOpen(false);
    setNotes('');
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={`h-7 px-2 text-[11px] gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 ${className}`}
        onClick={() => setOpen(true)}
      >
        <Target className="h-3 w-3" />
        Request Target/Revise Price
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Request target / revised price</DialogTitle>
            <DialogDescription>
              Sends a task to the procurement head for “{itemLabel}”. They will assign it within
              their team and revert with a fresh price and validity.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="revise-target">Target price (optional)</Label>
              <Input
                id="revise-target"
                type="number"
                min="0"
                step="0.01"
                placeholder="Customer's expected rate"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revise-notes">Notes (optional)</Label>
              <Textarea
                id="revise-notes"
                rows={3}
                placeholder="Context for procurement — urgency, competitor price, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send to procurement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState, useEffect } from 'react';
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
import { DollarSign, Target, AlertTriangle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { type EnquiryItem } from '@/hooks/useEnquiryItems';

interface RequestPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EnquiryItem | null;
  onSubmit: (data: { targetRate?: number; priority: string; notes?: string }) => Promise<void>;
  isSubmitting?: boolean;
  isReprice?: boolean;
  defaultTargetRate?: number | null;
}

export function RequestPriceDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
  isSubmitting = false,
  isReprice = false,
  defaultTargetRate,
}: RequestPriceDialogProps) {
  const [targetRate, setTargetRate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');

  // Initialize targetRate from defaultTargetRate or item.target_rate when dialog opens
  useEffect(() => {
    if (open) {
      const initialRate = defaultTargetRate || item?.target_rate;
      if (initialRate && initialRate > 0) {
        setTargetRate(initialRate.toString());
      } else {
        setTargetRate('');
      }
      setPriority('normal');
      setNotes('');
    }
  }, [open, defaultTargetRate, item?.target_rate]);

  const handleSubmit = async () => {
    await onSubmit({
      targetRate: targetRate ? parseFloat(targetRate) : undefined,
      priority,
      notes: notes || undefined,
    });
    // Reset form
    setTargetRate('');
    setPriority('normal');
    setNotes('');
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {isReprice ? 'Request Reprice' : 'Request Price from Procurement'}
          </DialogTitle>
          <DialogDescription>
            {isReprice 
              ? 'Request a new price for this item from the procurement team.'
              : 'Send this item to procurement for pricing. Optionally provide the customer\'s expected price.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Item Info */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="font-medium text-sm">{item.product_query_text}</div>
            <div className="text-xs text-muted-foreground">
              Quantity: {item.quantity || 1}
            </div>
          </div>

          {/* Target Rate (Customer's Expected Price) */}
          <div className="space-y-2">
            <Label htmlFor="target-rate" className="flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-600" />
              Customer's Expected Price (Optional)
            </Label>
            <Input
              id="target-rate"
              type="number"
              placeholder="Enter customer's target price"
              value={targetRate}
              onChange={(e) => setTargetRate(e.target.value)}
              className="focus-visible:ring-amber-500"
            />
            <p className="text-xs text-muted-foreground">
              This helps procurement negotiate a price that gives us margin
            </p>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">
                  <span className="flex items-center gap-2">
                    High
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">
                      Priority
                    </Badge>
                  </span>
                </SelectItem>
                <SelectItem value="urgent">
                  <span className="flex items-center gap-2">
                    Urgent
                    <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      ASAP
                    </Badge>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes for Procurement (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional context for procurement..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send to Procurement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
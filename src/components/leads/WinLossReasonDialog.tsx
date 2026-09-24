import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trophy, XCircle, DollarSign, Star, Truck, Clock, Users, Shield, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export const WIN_REASONS = [
  { value: 'price', label: 'Competitive Price', icon: DollarSign, description: 'Our pricing was more attractive' },
  { value: 'quality', label: 'Product Quality', icon: Star, description: 'Superior quality met their needs' },
  { value: 'delivery_time', label: 'Fast Delivery', icon: Truck, description: 'Quick delivery timeline' },
  { value: 'relationship', label: 'Customer Relationship', icon: Users, description: 'Strong existing relationship' },
  { value: 'trust', label: 'Brand Trust', icon: Shield, description: 'Trust in our brand/company' },
  { value: 'service', label: 'Better Service', icon: Star, description: 'Superior customer service' },
  { value: 'other', label: 'Others', icon: HelpCircle, description: 'Specify in notes' },
] as const;

export const LOST_REASONS = [
  { value: 'price', label: 'Price Too High', icon: DollarSign, description: 'Our pricing was not competitive' },
  { value: 'quality', label: 'Quality Concerns', icon: Star, description: 'Quality did not meet expectations' },
  { value: 'delivery_time', label: 'Delivery Time', icon: Truck, description: 'Delivery timeline was too long' },
  { value: 'competitor', label: 'Went to Competitor', icon: Users, description: 'Customer chose a competitor' },
  { value: 'budget', label: 'Budget Constraints', icon: DollarSign, description: 'Customer had budget limitations' },
  { value: 'no_response', label: 'No Response', icon: Clock, description: 'Customer stopped responding' },
  { value: 'not_needed', label: 'No Longer Needed', icon: XCircle, description: 'Customer no longer requires product' },
  { value: 'project_cancelled', label: 'Project Cancelled', icon: XCircle, description: 'Customer cancelled their project' },
  { value: 'wrong_contact', label: 'Wrong Contact', icon: Users, description: 'Not the right person or company' },
  { value: 'duplicate_lead', label: 'Duplicate Lead', icon: Clock, description: 'Already exists as another lead' },
  { value: 'other', label: 'Others', icon: HelpCircle, description: 'Specify in notes' },
] as const;

export type WinReason = typeof WIN_REASONS[number]['value'];
export type LostReason = typeof LOST_REASONS[number]['value'];

interface WinLossReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'won' | 'lost';
  onConfirm: (reason: string, notes?: string) => void;
  isLoading?: boolean;
}

export function WinLossReasonDialog({ 
  open, 
  onOpenChange, 
  type, 
  onConfirm,
  isLoading = false 
}: WinLossReasonDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [notes, setNotes] = useState('');

  const reasons = type === 'won' ? WIN_REASONS : LOST_REASONS;
  const Icon = type === 'won' ? Trophy : XCircle;
  const colorClass = type === 'won' ? 'text-green-500' : 'text-destructive';
  const bgClass = type === 'won' ? 'bg-green-500/10' : 'bg-destructive/10';

  // Check if "Other" is selected and notes are required
  const isOtherSelected = selectedReason === 'other';
  const isNotesRequired = isOtherSelected && !notes.trim();

  const handleConfirm = () => {
    if (!selectedReason) return;
    if (isNotesRequired) return; // Don't submit if "other" selected without notes
    onConfirm(selectedReason, notes.trim() || undefined);
    // Reset form
    setSelectedReason('');
    setNotes('');
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedReason('');
      setNotes('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden grid grid-rows-[auto_1fr_auto] gap-0">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3">
            <motion.div
              className={cn('p-2 rounded-lg', bgClass)}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Icon className={cn('h-5 w-5', colorClass)} />
            </motion.div>
            Mark as {type === 'won' ? 'Won' : 'Lost'}
          </DialogTitle>
          <DialogDescription>
            {type === 'won' 
              ? 'What was the main reason for winning this deal?' 
              : 'What was the main reason for losing this deal?'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-2 py-2">
          <div className="space-y-4">
            <RadioGroup
              value={selectedReason}
              onValueChange={setSelectedReason}
              className="space-y-2"
            >
              <AnimatePresence mode="popLayout">
                {reasons.map((reason, index) => {
                  const ReasonIcon = reason.icon;
                  const isSelected = selectedReason === reason.value;
                  
                  return (
                    <motion.div
                      key={reason.value}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Label
                        htmlFor={reason.value}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                          isSelected 
                            ? type === 'won' 
                              ? 'border-green-500 bg-green-500/5' 
                              : 'border-destructive bg-destructive/5'
                            : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                        )}
                      >
                        <RadioGroupItem value={reason.value} id={reason.value} />
                        <ReasonIcon className={cn(
                          'h-4 w-4 flex-shrink-0',
                          isSelected ? colorClass : 'text-muted-foreground'
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm font-medium',
                            isSelected && colorClass
                          )}>
                            {reason.label}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {reason.description}
                          </p>
                        </div>
                      </Label>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </RadioGroup>

            {selectedReason && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <Label htmlFor="notes" className="text-sm text-muted-foreground">
                  {selectedReason === 'other' 
                    ? 'Please specify the reason (required)' 
                    : 'Additional notes (optional)'
                  }
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={selectedReason === 'other' 
                    ? 'Please specify the reason...' 
                    : 'Add any additional context...'
                  }
                  className={cn(
                    "mt-2 resize-none",
                    isOtherSelected && !notes.trim() && "border-destructive focus-visible:ring-destructive"
                  )}
                  rows={3}
                />
                {isOtherSelected && !notes.trim() && (
                  <p className="text-xs text-destructive mt-1">Please provide details for "Others" reason</p>
                )}
              </motion.div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedReason || isLoading || isNotesRequired}
            className={type === 'won' 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-destructive hover:bg-destructive/90'
            }
          >
            {isLoading ? 'Saving...' : `Mark as ${type === 'won' ? 'Won' : 'Lost'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

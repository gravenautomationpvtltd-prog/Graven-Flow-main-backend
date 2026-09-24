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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCustomers } from '@/hooks/useCustomers';
import { useSetPriority } from '@/hooks/useExecutiveActions';
import { Star, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SetPriorityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetPriorityDialog({ open, onOpenChange }: SetPriorityDialogProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const { data: customers, isLoading: customersLoading } = useCustomers();
  const setPriority = useSetPriority();

  const selectedCustomer = customers?.data?.find(c => c.id === selectedCustomerId);
  const isPriority = (selectedCustomer as any)?.is_priority || false;

  const handleSubmit = () => {
    if (!selectedCustomerId) return;

    setPriority.mutate({
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.company_name || '',
      isPriority: !isPriority,
      reason,
      notes,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setSelectedCustomerId('');
    setReason('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            Set Priority Customer
          </DialogTitle>
          <DialogDescription>
            Mark a customer as priority for expedited service and special attention.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Customer</Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a customer..." />
              </SelectTrigger>
              <SelectContent>
                {customersLoading ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : (
                  customers?.data?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      <div className="flex items-center gap-2">
                        {customer.company_name}
                        {(customer as any)?.is_priority && (
                          <Badge className="bg-amber-500 text-xs">
                            <Crown className="h-3 w-3 mr-1" />
                            Priority
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedCustomer && (
            <div className={`p-3 rounded-lg text-sm ${isPriority ? 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800' : 'bg-muted'}`}>
              <div className="flex items-center justify-between">
                <span>
                  <strong>Status:</strong> {isPriority ? 'Priority Customer' : 'Standard Customer'}
                </span>
                {isPriority && <Crown className="h-4 w-4 text-amber-500" />}
              </div>
              <p className="mt-1 text-muted-foreground">
                {isPriority 
                  ? 'This customer receives priority treatment and expedited service.' 
                  : 'This customer follows standard service procedures.'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high_value_account">High Value Account</SelectItem>
                <SelectItem value="strategic_partnership">Strategic Partnership</SelectItem>
                <SelectItem value="key_reference_customer">Key Reference Customer</SelectItem>
                <SelectItem value="growth_potential">High Growth Potential</SelectItem>
                <SelectItem value="retention_critical">Retention Critical</SelectItem>
                <SelectItem value="executive_relationship">Executive Relationship</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes about this priority designation..."
              rows={3}
            />
          </div>

          {!isPriority && selectedCustomer && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <h4 className="font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <Star className="h-4 w-4" />
                Priority Benefits
              </h4>
              <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                <li>Expedited order processing</li>
                <li>Dedicated support attention</li>
                <li>Priority in inventory allocation</li>
                <li>Executive visibility in dashboards</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedCustomerId || setPriority.isPending}
            className={isPriority ? '' : 'bg-amber-500 hover:bg-amber-600'}
          >
            {setPriority.isPending 
              ? (isPriority ? 'Removing...' : 'Setting...') 
              : (isPriority ? 'Remove Priority' : 'Set as Priority')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

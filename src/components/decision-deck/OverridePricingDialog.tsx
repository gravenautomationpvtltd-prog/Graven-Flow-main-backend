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
import { useCustomers } from '@/hooks/useCustomers';
import { useOverridePricing } from '@/hooks/useExecutiveActions';
import { DollarSign, Percent } from 'lucide-react';

interface OverridePricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OverridePricingDialog({ open, onOpenChange }: OverridePricingDialogProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const { data: customers, isLoading: customersLoading } = useCustomers();
  const overridePricing = useOverridePricing();

  const selectedCustomer = customers?.data?.find(c => c.id === selectedCustomerId);

  const handleSubmit = () => {
    if (!selectedCustomerId || !discountPercent) return;

    overridePricing.mutate({
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.company_name || '',
      previousDiscount: (selectedCustomer as any)?.special_discount_pct || 0,
      newDiscount: parseFloat(discountPercent),
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
    setDiscountPercent('');
    setReason('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Override Pricing
          </DialogTitle>
          <DialogDescription>
            Apply a special discount percentage for a customer. This will be logged for audit purposes.
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
                      {customer.company_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedCustomer && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p><strong>Current Discount:</strong> {(selectedCustomer as any)?.special_discount_pct || 0}%</p>
              <p><strong>Contact:</strong> {selectedCustomer.contact_person || 'N/A'}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>New Discount Percentage</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                placeholder="Enter discount %"
                className="pr-10"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high_volume_customer">High Volume Customer</SelectItem>
                <SelectItem value="strategic_account">Strategic Account</SelectItem>
                <SelectItem value="competitive_pressure">Competitive Pressure</SelectItem>
                <SelectItem value="relationship_building">Relationship Building</SelectItem>
                <SelectItem value="market_penetration">Market Penetration</SelectItem>
                <SelectItem value="retention_risk">Retention Risk</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedCustomerId || !discountPercent || overridePricing.isPending}
          >
            {overridePricing.isPending ? 'Applying...' : 'Apply Override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

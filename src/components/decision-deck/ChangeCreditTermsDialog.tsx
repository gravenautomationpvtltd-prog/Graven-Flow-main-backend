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
import { useCustomers } from '@/hooks/useCustomers';
import { useChangeCreditTerms } from '@/hooks/useExecutiveActions';
import { CreditCard } from 'lucide-react';

interface ChangeCreditTermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeCreditTermsDialog({ open, onOpenChange }: ChangeCreditTermsDialogProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [paymentDays, setPaymentDays] = useState('30');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const { data: customers, isLoading: customersLoading } = useCustomers();
  const changeCreditTerms = useChangeCreditTerms();

  const selectedCustomer = customers?.data?.find(c => c.id === selectedCustomerId);

  useEffect(() => {
    if (selectedCustomer) {
      setCreditLimit((selectedCustomer as any)?.credit_limit?.toString() || '');
      setPaymentDays((selectedCustomer as any)?.payment_days?.toString() || '30');
    }
  }, [selectedCustomer]);

  const handleSubmit = () => {
    if (!selectedCustomerId) return;

    changeCreditTerms.mutate({
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.company_name || '',
      previousCreditLimit: (selectedCustomer as any)?.credit_limit || null,
      previousPaymentDays: (selectedCustomer as any)?.payment_days || 30,
      newCreditLimit: creditLimit ? parseFloat(creditLimit) : null,
      newPaymentDays: parseInt(paymentDays) || 30,
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
    setCreditLimit('');
    setPaymentDays('30');
    setReason('');
    setNotes('');
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return 'Not Set';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Change Credit Terms
          </DialogTitle>
          <DialogDescription>
            Modify credit limit and payment terms for a customer. Changes are logged for audit.
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
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <p><strong>Current Credit Limit:</strong> {formatCurrency((selectedCustomer as any)?.credit_limit)}</p>
              <p><strong>Current Payment Days:</strong> {(selectedCustomer as any)?.payment_days || 30} days</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Credit Limit (₹)</Label>
              <Input
                type="number"
                min="0"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="Enter amount"
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Days</Label>
              <Select value={paymentDays} onValueChange={setPaymentDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="15">15 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="45">45 Days</SelectItem>
                  <SelectItem value="60">60 Days</SelectItem>
                  <SelectItem value="90">90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good_payment_history">Good Payment History</SelectItem>
                <SelectItem value="increased_business">Increased Business Volume</SelectItem>
                <SelectItem value="strategic_partnership">Strategic Partnership</SelectItem>
                <SelectItem value="credit_review">Regular Credit Review</SelectItem>
                <SelectItem value="risk_mitigation">Risk Mitigation</SelectItem>
                <SelectItem value="payment_default">Payment Default Recovery</SelectItem>
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
            disabled={!selectedCustomerId || changeCreditTerms.isPending}
          >
            {changeCreditTerms.isPending ? 'Updating...' : 'Update Terms'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

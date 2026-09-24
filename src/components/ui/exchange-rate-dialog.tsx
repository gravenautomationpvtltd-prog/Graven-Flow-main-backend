import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCurrencySymbol, type CurrencyCode } from '@/lib/currency-utils';
import { ArrowRight } from 'lucide-react';

interface ExchangeRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetCurrency: CurrencyCode;
  currentRate: number;
  sampleAmount?: number;
  onConfirm: (rate: number) => void;
  onCancel: () => void;
}

export function ExchangeRateDialog({
  open,
  onOpenChange,
  targetCurrency,
  currentRate,
  sampleAmount = 10000,
  onConfirm,
  onCancel,
}: ExchangeRateDialogProps) {
  const [rate, setRate] = useState(currentRate > 1 ? currentRate.toString() : '');

  useEffect(() => {
    if (open && currentRate > 1) {
      setRate(currentRate.toString());
    } else if (open) {
      setRate('');
    }
  }, [open, currentRate]);

  const numericRate = parseFloat(rate) || 0;
  const convertedAmount = numericRate > 0 ? sampleAmount / numericRate : 0;
  const targetSymbol = getCurrencySymbol(targetCurrency);

  const handleConfirm = () => {
    if (numericRate > 0) {
      onConfirm(numericRate);
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Currency Conversion</DialogTitle>
          <DialogDescription>
            You're changing the currency to {targetCurrency}. Enter the exchange rate to convert prices from INR.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="exchange-rate">Exchange Rate</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">1 {targetCurrency} =</span>
              <Input
                id="exchange-rate"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g., 84.15"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-32"
                autoFocus
              />
              <span className="text-sm font-medium">INR</span>
            </div>
          </div>

          {numericRate > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Preview conversion:</p>
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>₹{sampleAmount.toLocaleString()}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-primary">{targetSymbol}{convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={numericRate <= 0}>
            Apply Conversion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

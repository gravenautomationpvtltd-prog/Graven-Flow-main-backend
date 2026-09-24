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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  priceRequestId: string;
  enquiryItemId: string | null;
  productLabel: string;
  targetRate: number | null;
  matchedProductId?: string | null;
}

export function PriceEntryDialog({
  open,
  onOpenChange,
  priceRequestId,
  enquiryItemId,
  productLabel,
  targetRate,
  matchedProductId,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [seller, setSeller] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPurchasePrice('');
    setSellingPrice('');
    setSeller('');
    setLeadTime('');
    setNotes('');
  };

  const handleSave = async () => {
    const purchase = parseFloat(purchasePrice);
    const selling = parseFloat(sellingPrice);
    if (!selling || selling <= 0) {
      toast.error('Enter a valid selling price');
      return;
    }
    if (!purchase || purchase <= 0) {
      toast.error('Enter a valid purchase price');
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    try {
      const leadTimeNum = leadTime ? parseInt(leadTime, 10) || null : null;

      // 1. Mark price request resolved with rich pricing data
      const { error: prErr } = await supabase
        .from('price_requests')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolved_price: selling, // mirror selling price for backward compat
          purchase_price: purchase,
          selling_price: selling,
          seller_name: seller || null,
          lead_time_days: leadTimeNum,
          notes: notes || null,
        } as any)
        .eq('id', priceRequestId);
      if (prErr) throw prErr;

      // 2. Push selling price + lead time to enquiry item (what SPT consumes)
      if (enquiryItemId) {
        const eiUpdate: any = {
          procurement_price: selling,
          price_available: true,
          price_resolved_at: new Date().toISOString(),
          price_resolved_by: user.id,
          pricing_status: 'updated',
        };
        await supabase.from('enquiry_items').update(eiUpdate).eq('id', enquiryItemId);
      }

      // 3. Update product library if matched (selling price + lead time)
      if (matchedProductId) {
        const update: any = {
          default_rate: selling,
          price_updated_at: new Date().toISOString(),
          price_updated_by: user.id,
        };
        if (leadTimeNum) update.lead_time_days = leadTimeNum;
        await supabase.from('products').update(update).eq('id', matchedProductId);
      }

      toast.success('Price recorded');
      qc.invalidateQueries({ queryKey: ['procurement-queue'] });
      qc.invalidateQueries({ queryKey: ['price-requests'] });
      qc.invalidateQueries({ queryKey: ['enquiry-items'] });
      qc.invalidateQueries({ queryKey: ['spt-inbox'] });
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save price');
    } finally {
      setSaving(false);
    }
  };

  const margin =
    purchasePrice && sellingPrice
      ? ((parseFloat(sellingPrice) - parseFloat(purchasePrice)) /
          parseFloat(sellingPrice)) *
        100
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Procurement Price</DialogTitle>
          <DialogDescription className="line-clamp-2">{productLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {targetRate ? (
            <p className="text-xs text-muted-foreground">
              Customer target: ₹{Math.round(targetRate).toLocaleString('en-IN')}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purchase">Purchase Price (₹) *</Label>
              <Input
                id="purchase"
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="cost from seller"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="selling">Selling Price (₹) *</Label>
              <Input
                id="selling"
                type="number"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="quote to customer"
              />
            </div>
          </div>

          {margin !== null && isFinite(margin) && (
            <p className="text-xs text-muted-foreground">
              Margin:{' '}
              <span
                className={
                  margin > 0 ? 'text-emerald-600 font-medium' : 'text-destructive font-medium'
                }
              >
                {margin.toFixed(1)}%
              </span>
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="seller">Seller / Vendor</Label>
            <Input
              id="seller"
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
              placeholder="e.g. ABC Traders"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lt">Lead time (days)</Label>
            <Input
              id="lt"
              type="number"
              value={leadTime}
              onChange={(e) => setLeadTime(e.target.value)}
              placeholder="optional"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Validity, MOQ, terms, etc."
              rows={2}
            />
          </div>

          <p className="text-[11px] text-muted-foreground border-t pt-2">
            Only <strong>selling price</strong> &amp; <strong>lead time</strong> are sent to Sales.
            Purchase price &amp; seller stay internal for margin tracking and order tally.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !purchasePrice || !sellingPrice}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save Price
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

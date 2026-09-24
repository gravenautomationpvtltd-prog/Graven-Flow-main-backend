import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { useCreateSupplierRating } from '@/hooks/useSupplierRatings';
import { cn } from '@/lib/utils';

interface RateSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
  poId?: string;
  grnId?: string;
}

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
            className="p-0.5 hover:scale-110 transition-transform"
          >
            <Star
              className={cn(
                'h-6 w-6 transition-colors',
                (hovered || value) >= star
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              )}
            />
          </button>
        ))}
        <span className="text-sm text-muted-foreground ml-2">
          {value > 0 ? `${value}/5` : 'Not rated'}
        </span>
      </div>
    </div>
  );
}

export function RateSupplierDialog({ 
  open, 
  onOpenChange, 
  supplierId, 
  supplierName,
  poId,
  grnId 
}: RateSupplierDialogProps) {
  const [qualityRating, setQualityRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [priceRating, setPriceRating] = useState(0);
  const [comments, setComments] = useState('');

  const createRating = useCreateSupplierRating();

  const handleSubmit = async () => {
    if (qualityRating === 0 || deliveryRating === 0 || priceRating === 0) {
      return;
    }

    await createRating.mutateAsync({
      supplier_id: supplierId,
      po_id: poId || null,
      grn_id: grnId || null,
      quality_rating: qualityRating,
      delivery_rating: deliveryRating,
      price_rating: priceRating,
      comments: comments || undefined,
    });

    // Reset form
    setQualityRating(0);
    setDeliveryRating(0);
    setPriceRating(0);
    setComments('');
    onOpenChange(false);
  };

  const averageRating = qualityRating && deliveryRating && priceRating
    ? ((qualityRating + deliveryRating + priceRating) / 3).toFixed(1)
    : null;

  const isValid = qualityRating > 0 && deliveryRating > 0 && priceRating > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-400" />
            Rate Supplier
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-muted p-3 rounded-lg">
            <p className="font-medium">{supplierName}</p>
            {poId && <p className="text-sm text-muted-foreground">Based on recent order</p>}
          </div>

          <div className="space-y-4">
            <StarRating
              label="Quality of Products"
              value={qualityRating}
              onChange={setQualityRating}
            />
            <StarRating
              label="Delivery Timeliness"
              value={deliveryRating}
              onChange={setDeliveryRating}
            />
            <StarRating
              label="Pricing Competitiveness"
              value={priceRating}
              onChange={setPriceRating}
            />
          </div>

          {averageRating && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Overall Rating</span>
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="font-bold">{averageRating}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="comments">Comments (Optional)</Label>
            <Textarea
              id="comments"
              placeholder="Any additional feedback about this supplier..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createRating.isPending || !isValid}>
            {createRating.isPending ? 'Submitting...' : 'Submit Rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

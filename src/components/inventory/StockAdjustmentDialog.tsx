import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAdjustStock, InventoryItem } from '@/hooks/useInventory';
import { Plus, Minus, RefreshCw, IndianRupee, AlertTriangle, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
}

export function StockAdjustmentDialog({ open, onOpenChange, item }: StockAdjustmentDialogProps) {
  const [movementType, setMovementType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const adjustStock = useAdjustStock();

  const rate = item?.product?.default_rate || 0;
  const currentValue = (item?.quantity || 0) * rate;

  const { newQuantity, newValue, goesNegative, goesBelowMin } = useMemo(() => {
    const qty = parseFloat(quantity) || 0;
    let newQty = item?.quantity || 0;
    
    if (movementType === 'in') {
      newQty = newQty + qty;
    } else if (movementType === 'out') {
      newQty = newQty - qty;
    } else {
      newQty = qty;
    }
    
    return {
      newQuantity: newQty,
      newValue: newQty * rate,
      goesNegative: newQty < 0,
      goesBelowMin: item?.min_stock_level ? newQty < item.min_stock_level : false
    };
  }, [quantity, movementType, item, rate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !quantity || goesNegative) return;

    await adjustStock.mutateAsync({
      product_id: item.product_id,
      office_id: item.office_id,
      adjustment: parseFloat(quantity),
      movement_type: movementType,
      notes: notes || undefined,
    });

    // Reset form
    setMovementType('in');
    setQuantity('');
    setNotes('');
    onOpenChange(false);
  };

  if (!item) return null;

  const isValid = quantity && parseFloat(quantity) > 0 && !goesNegative;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Item Info Card */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="font-medium text-lg">{item.product?.name}</div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Office:</span>
              <span className="font-medium">{item.office?.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Stock:</span>
              <span className="font-medium">{item.quantity} {item.product?.unit || 'Nos'}</span>
            </div>
            {rate > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Value:</span>
                <span className="font-medium text-blue-600">₹{currentValue.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          {/* Movement Type Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Movement Type</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={movementType === 'in' ? 'default' : 'outline'}
                className={cn(
                  "flex items-center gap-2",
                  movementType === 'in' && "bg-green-600 hover:bg-green-700"
                )}
                onClick={() => setMovementType('in')}
              >
                <Plus className="h-4 w-4" />
                Stock In
              </Button>
              <Button
                type="button"
                variant={movementType === 'out' ? 'default' : 'outline'}
                className={cn(
                  "flex items-center gap-2",
                  movementType === 'out' && "bg-red-600 hover:bg-red-700"
                )}
                onClick={() => setMovementType('out')}
              >
                <Minus className="h-4 w-4" />
                Stock Out
              </Button>
              <Button
                type="button"
                variant={movementType === 'adjustment' ? 'default' : 'outline'}
                className="flex items-center gap-2"
                onClick={() => setMovementType('adjustment')}
              >
                <RefreshCw className="h-4 w-4" />
                Set To
              </Button>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-sm font-medium">
              {movementType === 'adjustment' ? 'New Quantity' : 'Quantity'}
            </Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={movementType === 'adjustment' ? 'Enter new quantity' : 'Enter quantity'}
              className={cn(goesNegative && "border-destructive")}
            />
          </div>

          {/* Preview Card */}
          {quantity && parseFloat(quantity) > 0 && (
            <div className={cn(
              "rounded-lg p-4 space-y-2 border-2 transition-colors",
              goesNegative ? "bg-destructive/10 border-destructive" :
              goesBelowMin ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-500" :
              movementType === 'in' ? "bg-green-50 dark:bg-green-950/30 border-green-500" :
              movementType === 'out' ? "bg-red-50 dark:bg-red-950/30 border-red-500" :
              "bg-muted border-muted-foreground/20"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">New Stock Level:</span>
                <div className="flex items-center gap-2">
                  {movementType === 'in' && <TrendingUp className="h-4 w-4 text-green-600" />}
                  {movementType === 'out' && <TrendingDown className="h-4 w-4 text-red-600" />}
                  <span className={cn(
                    "font-bold text-lg",
                    goesNegative ? "text-destructive" :
                    movementType === 'in' ? "text-green-600" :
                    movementType === 'out' ? "text-red-600" : ""
                  )}>
                    {newQuantity.toLocaleString()} {item.product?.unit || 'Nos'}
                  </span>
                </div>
              </div>
              
              {rate > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">New Value:</span>
                  <span className="font-medium flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" />
                    ₹{newValue.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {goesNegative && (
                <div className="flex items-center gap-2 text-destructive text-sm mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Stock cannot go negative!</span>
                </div>
              )}

              {!goesNegative && goesBelowMin && (
                <div className="flex items-center gap-2 text-yellow-600 text-sm mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>This will put stock below minimum level ({item.min_stock_level})</span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for adjustment..."
              rows={2}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!isValid || adjustStock.isPending}
              className={cn(
                movementType === 'in' && "bg-green-600 hover:bg-green-700",
                movementType === 'out' && "bg-red-600 hover:bg-red-700"
              )}
            >
              {adjustStock.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShoppingCart, Package } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useActiveSuppliers } from '@/hooks/useSuppliers';
import { useCreatePurchaseOrder } from '@/hooks/usePurchaseOrders';
import type { InventoryItem } from '@/hooks/useInventory';

interface QuickPODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: InventoryItem[];
}

interface POItem {
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  suggestedQty: number;
}

export function QuickPODialog({ open, onOpenChange, items }: QuickPODialogProps) {
  const { data: suppliers = [] } = useActiveSuppliers();
  const createPO = useCreatePurchaseOrder();
  
  const [supplierId, setSupplierId] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [poItems, setPoItems] = useState<POItem[]>([]);

  useEffect(() => {
    if (items.length > 0) {
      setPoItems(
        items.map(item => {
          const minStock = item.min_stock_level || 0;
          const currentStock = item.quantity;
          const suggestedQty = Math.max(minStock * 2 - currentStock, minStock);
          
          return {
            productId: item.product_id,
            productName: item.product?.name || 'Unknown Product',
            quantity: suggestedQty,
            rate: item.product?.default_rate || 0,
            suggestedQty,
          };
        })
      );
    }
  }, [items]);

  const handleQuantityChange = (index: number, qty: number) => {
    const updated = [...poItems];
    updated[index].quantity = Math.max(0, qty);
    setPoItems(updated);
  };

  const handleRateChange = (index: number, rate: number) => {
    const updated = [...poItems];
    updated[index].rate = Math.max(0, rate);
    setPoItems(updated);
  };

  const handleSubmit = async () => {
    if (!supplierId) return;

    const validItems = poItems.filter(item => item.quantity > 0);
    if (validItems.length === 0) return;

    await createPO.mutateAsync({
      supplier_id: supplierId,
      expected_delivery: expectedDelivery || null,
      notes: notes || null,
      items: validItems.map(item => ({
        product_id: item.productId,
        description: item.productName,
        hsn_code: null,
        quantity: item.quantity,
        rate: item.rate,
        tax_percent: 18,
        tax_amount: (item.quantity * item.rate * 18) / 100,
        amount: item.quantity * item.rate,
        received_quantity: 0,
        sort_order: 0,
      })),
    });

    onOpenChange(false);
  };

  const totalAmount = poItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const totalTax = totalAmount * 0.18;
  const grandTotal = totalAmount + totalTax;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Quick Purchase Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Supplier Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expected Delivery</Label>
              <Input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <Label>Items</Label>
            {poItems.map((item, index) => (
              <div
                key={item.productId}
                className="flex items-center gap-4 p-3 border rounded-lg bg-card"
              >
                <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    Suggested: {item.suggestedQty} units
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(index, Number(e.target.value))}
                      className="h-8"
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">Rate</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.rate}
                      onChange={(e) => handleRateChange(index, Number(e.target.value))}
                      className="h-8"
                    />
                  </div>
                  <div className="w-24 text-right">
                    <Label className="text-xs">Amount</Label>
                    <p className="font-medium text-sm">
                      ₹{(item.quantity * item.rate).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-48 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax (18%):</span>
                <span>₹{totalTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Grand Total:</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createPO.isPending || !supplierId || poItems.every(i => i.quantity === 0)}
          >
            {createPO.isPending ? 'Creating...' : 'Create PO'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

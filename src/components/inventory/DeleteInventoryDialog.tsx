import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteInventory, InventoryItem } from '@/hooks/useInventory';
import { AlertTriangle, Package, IndianRupee, Loader2 } from 'lucide-react';

interface DeleteInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
}

export function DeleteInventoryDialog({ open, onOpenChange, item }: DeleteInventoryDialogProps) {
  const deleteInventory = useDeleteInventory();

  const handleDelete = async () => {
    if (!item) return;
    await deleteInventory.mutateAsync(item.id);
    onOpenChange(false);
  };

  if (!item) return null;

  const rate = item.product?.default_rate || 0;
  const stockValue = item.quantity * rate;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">Delete Inventory Item</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>Are you sure you want to remove this item from inventory? This action cannot be undone.</p>
              
              {/* Item Details Card */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-foreground">{item.product?.name}</div>
                    {item.product?.hsn_code && (
                      <div className="text-xs text-muted-foreground">HSN: {item.product.hsn_code}</div>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Office:</span>
                    <span className="font-medium text-foreground">{item.office?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-medium text-foreground">{item.quantity} {item.product?.unit || 'Nos'}</span>
                  </div>
                </div>

                {stockValue > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <IndianRupee className="h-3 w-3" />
                      Stock Value to Remove:
                    </span>
                    <span className="font-bold text-destructive">
                      ₹{stockValue.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteInventory.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteInventory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

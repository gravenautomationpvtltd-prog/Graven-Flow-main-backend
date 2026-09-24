import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package, AlertTriangle, ShoppingCart } from "lucide-react";
import { useLowStockItems, InventoryItem } from "@/hooks/useInventory";
import { StockAdjustmentDialog } from "./StockAdjustmentDialog";
import { QuickPODialog } from "@/components/procurement/QuickPODialog";

interface LowStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LowStockDialog({ open, onOpenChange }: LowStockDialogProps) {
  const { data: lowStockItems = [], isLoading } = useLowStockItems();
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [quickPOOpen, setQuickPOOpen] = useState(false);
  const [selectedForPO, setSelectedForPO] = useState<InventoryItem[]>([]);

  const filteredItems = lowStockItems.filter(item =>
    item.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.office?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdjustStock = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Low Stock Items
              <Badge variant="secondary" className="ml-2">
                {lowStockItems.length} items
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search low stock items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search ? "No items match your search" : "All stock levels are healthy"}
              </div>
            ) : (
              filteredItems.map((item) => {
                const deficit = (item.min_stock_level || 0) - item.quantity;
                const rate = item.product?.default_rate || 0;
                const value = item.quantity * rate;

                return (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">
                            {item.product?.name || "Unknown Product"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.office?.name || "Unknown Office"}
                        </p>
                        
                        <div className="flex flex-wrap gap-4 mt-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Current: </span>
                            <span className="font-medium text-destructive">
                              {item.quantity} {item.product?.unit || "units"}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Minimum: </span>
                            <span className="font-medium">
                              {item.min_stock_level || 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Deficit: </span>
                            <Badge variant="destructive" className="text-xs">
                              -{deficit}
                            </Badge>
                          </div>
                        </div>

                        {rate > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Value: ₹{rate.toLocaleString("en-IN")} × {item.quantity} = ₹{value.toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedForPO([item]);
                            setQuickPOOpen(true);
                          }}
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Create PO
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAdjustStock(item)}
                        >
                          Adjust Stock
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <StockAdjustmentDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        item={selectedItem}
      />

      <QuickPODialog
        open={quickPOOpen}
        onOpenChange={setQuickPOOpen}
        items={selectedForPO}
      />
    </>
  );
}

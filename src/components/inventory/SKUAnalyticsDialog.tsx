import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Search, Package } from 'lucide-react';
import { useInventory, InventoryItem } from '@/hooks/useInventory';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface SKUAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function SKUAnalyticsDialog({ open, onOpenChange }: SKUAnalyticsDialogProps) {
  const [search, setSearch] = useState('');
  const { data: inventory = [] } = useInventory();

  const filteredInventory = inventory.filter(item =>
    item.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.product?.hsn_code?.toLowerCase().includes(search.toLowerCase())
  );

  // Aggregate by product
  const productAggregates = inventory.reduce((acc, item) => {
    const productId = item.product_id;
    if (!acc[productId]) {
      acc[productId] = {
        name: item.product?.name || 'Unknown',
        hsn: item.product?.hsn_code || '-',
        quantity: 0,
        value: 0,
        minStock: item.min_stock_level || 0,
      };
    }
    acc[productId].quantity += item.quantity;
    acc[productId].value += item.quantity * (item.product?.default_rate || 0);
    return acc;
  }, {} as Record<string, { name: string; hsn: string; quantity: number; value: number; minStock: number }>);

  const productList = Object.values(productAggregates).sort((a, b) => b.value - a.value);

  const chartData = productList.slice(0, 5).map(p => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
    value: p.quantity,
  }));

  const getStockHealth = (quantity: number, minStock: number) => {
    if (quantity <= 0) return { label: 'Out of Stock', variant: 'destructive' as const };
    if (quantity <= minStock) return { label: 'Low', variant: 'secondary' as const };
    if (quantity <= minStock * 1.5) return { label: 'Warning', variant: 'outline' as const };
    return { label: 'Healthy', variant: 'default' as const };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            SKU Analytics
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto pr-2">
          {/* Chart Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Stock Distribution (Top 5)</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} units`, 'Quantity']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{productList.length}</div>
                <div className="text-xs text-muted-foreground">Total SKUs</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {productList.filter(p => p.quantity > p.minStock * 1.5).length}
                </div>
                <div className="text-xs text-muted-foreground">Healthy</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {productList.filter(p => p.quantity <= p.minStock).length}
                </div>
                <div className="text-xs text-muted-foreground">Low Stock</div>
              </div>
            </div>
          </div>

          {/* Product List */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {productList
                .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
                .map((product, idx) => {
                  const health = getStockHealth(product.quantity, product.minStock);
                  return (
                    <div key={idx} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{product.name}</span>
                        <Badge variant={health.variant}>{health.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>HSN: {product.hsn}</span>
                        <span>{product.quantity} units</span>
                        <span>₹{product.value.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

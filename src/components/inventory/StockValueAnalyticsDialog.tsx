import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IndianRupee, TrendingUp, AlertTriangle } from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface StockValueAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function StockValueAnalyticsDialog({ open, onOpenChange }: StockValueAnalyticsDialogProps) {
  const { data: inventory = [] } = useInventory();
  const { data: offices = [] } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Calculate total value
  const totalValue = inventory.reduce((sum, item) => {
    return sum + (item.quantity * (item.product?.default_rate || 0));
  }, 0);

  // Value by office
  const valueByOffice = offices.map(office => {
    const officeInventory = inventory.filter(i => i.office_id === office.id);
    const value = officeInventory.reduce((sum, item) => {
      return sum + (item.quantity * (item.product?.default_rate || 0));
    }, 0);
    return {
      name: office.name,
      value,
      percentage: totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0',
    };
  });

  // Value by product (top 10)
  const valueByProduct = inventory
    .map(item => ({
      name: item.product?.name || 'Unknown',
      value: item.quantity * (item.product?.default_rate || 0),
      quantity: item.quantity,
      rate: item.product?.default_rate || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Value at risk (low stock items)
  const lowStockValue = inventory
    .filter(item => item.quantity <= (item.min_stock_level || 0))
    .reduce((sum, item) => sum + (item.quantity * (item.product?.default_rate || 0)), 0);

  // Top valuable items
  const topItems = inventory
    .map(item => ({
      name: item.product?.name || 'Unknown',
      office: item.office?.name || 'Unknown',
      quantity: item.quantity,
      rate: item.product?.default_rate || 0,
      value: item.quantity * (item.product?.default_rate || 0),
      percentage: totalValue > 0 ? ((item.quantity * (item.product?.default_rate || 0)) / totalValue * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const formatCurrency = (value: number) => {
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)}L`;
    }
    return `₹${value.toLocaleString('en-IN')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Stock Value Analytics
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto pr-2">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <IndianRupee className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">Total Stock Value</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalValue)}</div>
            </div>

            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Avg Value/SKU</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(inventory.length > 0 ? totalValue / inventory.length : 0)}
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-muted-foreground">Value at Risk</span>
              </div>
              <div className="text-2xl font-bold text-yellow-600">{formatCurrency(lowStockValue)}</div>
              <div className="text-xs text-muted-foreground">Low stock items</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Value by Office Pie Chart */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">Value by Office</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={valueByOffice}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                      labelLine={false}
                    >
                      {valueByOffice.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [formatCurrency(value as number), 'Value']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Value by Product Bar Chart */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">Top Products by Value</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valueByProduct.slice(0, 5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} className="text-xs" />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100} 
                      className="text-xs"
                      tickFormatter={(v) => v.length > 12 ? v.substring(0, 12) + '...' : v}
                    />
                    <Tooltip formatter={(value) => [formatCurrency(value as number), 'Value']} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Valuable Items Table */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-3">Top Valuable Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Product</th>
                    <th className="text-left p-3 font-medium">Office</th>
                    <th className="text-right p-3 font-medium">Qty</th>
                    <th className="text-right p-3 font-medium">Rate</th>
                    <th className="text-right p-3 font-medium">Value</th>
                    <th className="text-right p-3 font-medium">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-3">{item.name}</td>
                      <td className="p-3 text-muted-foreground">{item.office}</td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3 text-right">₹{item.rate.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(item.value)}</td>
                      <td className="p-3 text-right text-muted-foreground">{item.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

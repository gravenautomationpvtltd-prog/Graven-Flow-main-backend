import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, ArrowUpDown, Package } from 'lucide-react';
import { useStockMovements } from '@/hooks/useInventory';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

interface StockMovementAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockMovementAnalyticsDialog({ open, onOpenChange }: StockMovementAnalyticsDialogProps) {
  const { data: movements = [] } = useStockMovements();

  // Calculate movement stats
  const stockIn = movements.filter(m => m.movement_type === 'in' || m.movement_type === 'adjustment' && m.quantity > 0);
  const stockOut = movements.filter(m => m.movement_type === 'out' || m.movement_type === 'dispatch');
  const adjustments = movements.filter(m => m.movement_type === 'adjustment');

  const totalIn = stockIn.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
  const totalOut = stockOut.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
  const netChange = totalIn - totalOut;

  // Last 7 days chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(date);
    const dayMovements = movements.filter(m => {
      const mDate = startOfDay(new Date(m.created_at));
      return mDate.getTime() === dayStart.getTime();
    });

    const dayIn = dayMovements
      .filter(m => m.movement_type === 'in')
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    const dayOut = dayMovements
      .filter(m => m.movement_type === 'out' || m.movement_type === 'dispatch')
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

    return {
      day: format(date, 'EEE'),
      in: dayIn,
      out: dayOut,
    };
  });

  // Top movers
  const productMovements = movements.reduce((acc, m) => {
    const name = m.product?.name || 'Unknown';
    if (!acc[name]) acc[name] = { name, total: 0 };
    acc[name].total += Math.abs(m.quantity);
    return acc;
  }, {} as Record<string, { name: string; total: number }>);

  const topMovers = Object.values(productMovements)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Stock Movement Analytics
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto pr-2">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Stock In</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{totalIn}</div>
              <div className="text-xs text-muted-foreground">{stockIn.length} transactions</div>
            </div>

            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-sm text-muted-foreground">Stock Out</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{totalOut}</div>
              <div className="text-xs text-muted-foreground">{stockOut.length} transactions</div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpDown className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">Adjustments</span>
              </div>
              <div className="text-2xl font-bold">{adjustments.length}</div>
              <div className="text-xs text-muted-foreground">manual corrections</div>
            </div>

            <div className={`rounded-lg p-4 ${netChange >= 0 ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800' : 'bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">Net Change</span>
              </div>
              <div className={`text-2xl font-bold ${netChange >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {netChange >= 0 ? '+' : ''}{netChange}
              </div>
              <div className="text-xs text-muted-foreground">units this period</div>
            </div>
          </div>

          {/* Chart */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-3">Last 7 Days Movement</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7Days}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="in" name="Stock In" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="out" name="Stock Out" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Top Movers */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">Top Movers</h3>
              <div className="space-y-2">
                {topMovers.length > 0 ? topMovers.map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{idx + 1}</Badge>
                      <span className="text-sm font-medium">{product.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{product.total} units</span>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No movements recorded</p>
                )}
              </div>
            </div>

            {/* Recent Movements */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">Recent Activity</h3>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {movements.slice(0, 5).map((movement, idx) => (
                  <div key={idx} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <div className="text-sm font-medium">{movement.product?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(movement.created_at), 'MMM d, h:mm a')}
                      </div>
                    </div>
                    <Badge variant={movement.movement_type === 'in' ? 'default' : 'secondary'}>
                      {movement.movement_type === 'in' ? '+' : '-'}{Math.abs(movement.quantity)}
                    </Badge>
                  </div>
                ))}
                {movements.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

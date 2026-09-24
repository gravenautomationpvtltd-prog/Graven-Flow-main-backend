import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useSupplierCorrelation } from '@/hooks/usePricingIntelligence';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function SupplierCorrelationChart() {
  const { data: suppliers, isLoading } = useSupplierCorrelation();

  const getWinRateColor = (rate: number) => {
    if (rate >= 60) return 'bg-green-500';
    if (rate >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getWinRateBadge = (rate: number) => {
    if (rate >= 60) return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">{rate.toFixed(0)}%</Badge>;
    if (rate >= 40) return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{rate.toFixed(0)}%</Badge>;
    if (rate > 0) return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">{rate.toFixed(0)}%</Badge>;
    return <Badge variant="outline">N/A</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (!suppliers || suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>No supplier correlation data available.</p>
        <p className="text-sm mt-1">Link suppliers to enquiry items to see insights.</p>
      </div>
    );
  }

  // Prepare chart data
  const chartData = suppliers.slice(0, 10).map(s => ({
    name: s.supplier_name.length > 15 ? s.supplier_name.substring(0, 15) + '...' : s.supplier_name,
    Won: s.orders_won,
    Lost: s.orders_lost,
    'Win Rate': s.win_rate,
  }));

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="name" 
              angle={-45} 
              textAnchor="end" 
              interval={0}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <YAxis className="fill-muted-foreground" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Bar dataKey="Won" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Lost" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-center">Products</TableHead>
              <TableHead className="text-center">Won</TableHead>
              <TableHead className="text-center">Lost</TableHead>
              <TableHead>Win Rate</TableHead>
              <TableHead>Performance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.supplier_id}>
                <TableCell className="font-medium">{supplier.supplier_name}</TableCell>
                <TableCell className="text-center">{supplier.products_supplied}</TableCell>
                <TableCell className="text-center text-green-500">{supplier.orders_won}</TableCell>
                <TableCell className="text-center text-red-500">{supplier.orders_lost}</TableCell>
                <TableCell>{getWinRateBadge(supplier.win_rate)}</TableCell>
                <TableCell className="w-[150px]">
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={supplier.win_rate} 
                      className={`h-2 ${getWinRateColor(supplier.win_rate)}`}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
          <h4 className="font-medium text-green-500 mb-2">Top Performers</h4>
          <ul className="text-sm space-y-1">
            {suppliers
              .filter(s => s.win_rate >= 60)
              .slice(0, 3)
              .map(s => (
                <li key={s.supplier_id} className="text-muted-foreground">
                  {s.supplier_name} - {s.win_rate.toFixed(0)}% win rate
                </li>
              ))}
            {suppliers.filter(s => s.win_rate >= 60).length === 0 && (
              <li className="text-muted-foreground">No suppliers with 60%+ win rate yet</li>
            )}
          </ul>
        </div>
        <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
          <h4 className="font-medium text-red-500 mb-2">Needs Improvement</h4>
          <ul className="text-sm space-y-1">
            {suppliers
              .filter(s => s.win_rate < 40 && s.orders_won + s.orders_lost > 0)
              .slice(0, 3)
              .map(s => (
                <li key={s.supplier_id} className="text-muted-foreground">
                  {s.supplier_name} - {s.win_rate.toFixed(0)}% win rate
                </li>
              ))}
            {suppliers.filter(s => s.win_rate < 40 && s.orders_won + s.orders_lost > 0).length === 0 && (
              <li className="text-muted-foreground">No suppliers below 40% win rate</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProcurementAnalytics } from '@/hooks/useProcurementAnalytics';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  FileText, IndianRupee, TrendingUp, Users, Clock, CheckCircle, XCircle, Package 
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function StatsCards({ stats, isLoading }: { stats?: any; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const items = [
    { label: 'Total POs', value: stats?.totalPOs || 0, icon: FileText, color: 'text-primary' },
    { label: 'Total Spend', value: formatCurrency(stats?.totalSpend || 0), icon: IndianRupee, color: 'text-green-500' },
    { label: 'Avg PO Value', value: formatCurrency(stats?.avgPOValue || 0), icon: TrendingUp, color: 'text-blue-500' },
    { label: 'Suppliers Used', value: stats?.suppliersUsed || 0, icon: Users, color: 'text-purple-500' },
    { label: 'Pending POs', value: stats?.pendingPOs || 0, icon: Clock, color: 'text-yellow-500' },
    { label: 'Approved POs', value: stats?.approvedPOs || 0, icon: CheckCircle, color: 'text-green-500' },
    { label: 'Rejected POs', value: stats?.rejectedPOs || 0, icon: XCircle, color: 'text-red-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function POTrendsChart({ data, isLoading }: { data?: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PO Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          PO Trends (Last 6 Months)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis yAxisId="left" className="text-xs" />
            <YAxis yAxisId="right" orientation="right" className="text-xs" tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              formatter={(value: number, name: string) => [
                name === 'amount' ? formatCurrency(value) : value,
                name === 'amount' ? 'Spend' : 'PO Count'
              ]}
            />
            <Area yAxisId="left" type="monotone" dataKey="count" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" name="count" />
            <Line yAxisId="right" type="monotone" dataKey="amount" stroke="hsl(var(--chart-2))" strokeWidth={2} name="amount" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function SpendingByCategoryChart({ data, isLoading }: { data?: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spending by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data?.slice(0, 5) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Spending by Supplier Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              formatter={(value: number) => [formatCurrency(value), 'Spend']}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function SupplierPerformanceTable({ data, isLoading }: { data?: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Suppliers Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const renderRating = (rating: number) => {
    if (!rating) return <span className="text-muted-foreground text-sm">N/A</span>;
    return (
      <div className="flex items-center gap-1">
        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        <span>{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Top Suppliers Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-center">POs</TableHead>
              <TableHead className="text-right">Total Spend</TableHead>
              <TableHead className="text-center">Quality</TableHead>
              <TableHead className="text-center">Delivery</TableHead>
              <TableHead className="text-center">Price</TableHead>
              <TableHead className="text-center">Overall</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No supplier data available
                </TableCell>
              </TableRow>
            ) : (
              data?.map((supplier) => (
                <TableRow key={supplier.supplierId}>
                  <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{supplier.totalPOs}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(supplier.totalAmount)}</TableCell>
                  <TableCell className="text-center">{renderRating(supplier.qualityRating)}</TableCell>
                  <TableCell className="text-center">{renderRating(supplier.deliveryRating)}</TableCell>
                  <TableCell className="text-center">{renderRating(supplier.priceRating)}</TableCell>
                  <TableCell className="text-center">{renderRating(supplier.avgRating)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ProcurementAnalytics() {
  const { data, isLoading } = useProcurementAnalytics(6);

  return (
    <div className="space-y-6">
      <StatsCards stats={data?.stats} isLoading={isLoading} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <POTrendsChart data={data?.poTrends} isLoading={isLoading} />
        <SpendingByCategoryChart data={data?.spendingByCategory} isLoading={isLoading} />
      </div>
      
      <SupplierPerformanceTable data={data?.supplierPerformance} isLoading={isLoading} />
    </div>
  );
}

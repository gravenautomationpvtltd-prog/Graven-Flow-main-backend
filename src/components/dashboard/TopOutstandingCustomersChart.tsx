import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useTopOutstandingCustomers } from '@/hooks/useAccountsDashboard';

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
};

interface TopOutstandingCustomersChartProps {
  data?: { name: string; amount: number }[];
  isLoading?: boolean;
}

export function TopOutstandingCustomersChart({ data: propData, isLoading: propLoading }: TopOutstandingCustomersChartProps) {
  const { data: hookData, isLoading: hookLoading } = useTopOutstandingCustomers();
  const rawData = propData || hookData;
  const isLoading = propLoading ?? hookLoading;

  if (isLoading) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Top Outstanding Customers</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-[350px]" /></CardContent>
      </Card>
    );
  }

  const chartData = (rawData || []).map(d => ({
    name: d.name.length > 20 ? d.name.slice(0, 18) + '…' : d.name,
    fullName: d.name,
    amount: d.amount,
  }));

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Top Outstanding Customers</CardTitle>
        <CardDescription>Customers with highest pending amounts</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tickFormatter={formatCurrency} className="text-xs fill-muted-foreground" />
            <YAxis type="category" dataKey="name" width={140} className="text-xs fill-muted-foreground" />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), 'Outstanding']}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
            />
            <Bar dataKey="amount" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

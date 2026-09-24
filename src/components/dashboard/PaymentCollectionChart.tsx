import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { usePaymentCollectionTrend } from '@/hooks/useAccountsDashboard';

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
};

export function PaymentCollectionChart({ enabled = true }: { enabled?: boolean }) {
  const { data, isLoading } = usePaymentCollectionTrend(enabled);

  if (!enabled || isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Collections</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-[300px]" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Collections</CardTitle>
        <CardDescription>Monthly payment receipts over last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
            <YAxis tickFormatter={formatCurrency} className="text-xs fill-muted-foreground" />
            <Tooltip formatter={(value: number) => [formatCurrency(value), 'Collected']} />
            <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

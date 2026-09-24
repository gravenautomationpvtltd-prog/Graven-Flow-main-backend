import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useReceivablesAging } from '@/hooks/useAccountsDashboard';

const COLORS = [
  'hsl(var(--success))',
  'hsl(142, 60%, 45%)',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
];

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
};

interface ReceivablesAgingChartProps {
  data?: { name: string; value: number }[];
  isLoading?: boolean;
}

export function ReceivablesAgingChart({ data: propData, isLoading: propLoading }: ReceivablesAgingChartProps) {
  // Use prop data if provided, otherwise fetch internally
  const { data: hookData, isLoading: hookLoading } = useReceivablesAging();
  const data = propData || hookData;
  const isLoading = propLoading ?? hookLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Receivables Aging</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-[300px]" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receivables Aging</CardTitle>
        <CardDescription>Outstanding amounts by age bucket</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
            <YAxis tickFormatter={formatCurrency} className="text-xs fill-muted-foreground" />
            <Tooltip formatter={(value: number) => [formatCurrency(value), 'Outstanding']} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {(data || []).map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

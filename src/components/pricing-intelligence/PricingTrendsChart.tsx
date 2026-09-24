import { Skeleton } from '@/components/ui/skeleton';
import { usePricingTrends } from '@/hooks/usePricingIntelligence';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  Area,
} from 'recharts';

export function PricingTrendsChart() {
  const { data: trends, isLoading } = usePricingTrends();

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground h-[400px]">
        <p>No trend data available yet.</p>
        <p className="text-sm mt-1">Pricing trends will appear after quotations are created.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Combined Chart */}
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trends} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <defs>
              <linearGradient id="winRateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number, name: string) => {
                if (name === 'win_rate' || name === 'avg_gap_percent') {
                  return [`${value.toFixed(1)}%`, name === 'win_rate' ? 'Win Rate' : 'Price Match Rate'];
                }
                return [value, 'Total Quotes'];
              }}
            />
            <Legend />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="win_rate"
              name="Win Rate"
              stroke="hsl(var(--chart-2))"
              fill="url(#winRateGradient)"
              strokeWidth={2}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="avg_gap_percent"
              name="Price Match Rate"
              stroke="hsl(var(--chart-4))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--chart-4))' }}
            />
            <Bar
              yAxisId="right"
              dataKey="total_quotes"
              name="Total Quotes"
              fill="hsl(var(--chart-1))"
              opacity={0.3}
              radius={[4, 4, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-muted/30 border">
          <p className="text-xs text-muted-foreground">Total Months</p>
          <p className="text-2xl font-bold">{trends.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-muted/30 border">
          <p className="text-xs text-muted-foreground">Avg Win Rate</p>
          <p className="text-2xl font-bold">
            {(trends.reduce((acc, t) => acc + t.win_rate, 0) / trends.length).toFixed(1)}%
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted/30 border">
          <p className="text-xs text-muted-foreground">Best Month</p>
          <p className="text-2xl font-bold text-green-500">
            {trends.reduce((max, t) => t.win_rate > max.win_rate ? t : max, trends[0])?.month || '-'}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted/30 border">
          <p className="text-xs text-muted-foreground">Total Quotes</p>
          <p className="text-2xl font-bold">
            {trends.reduce((acc, t) => acc + t.total_quotes, 0)}
          </p>
        </div>
      </div>
    </div>
  );
}

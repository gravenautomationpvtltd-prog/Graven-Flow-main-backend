import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { SegmentRevenueData } from '@/hooks/useSegmentRevenue';
import { formatRoundedINR } from '@/lib/currency-utils';

interface SegmentRevenueChartProps {
  data?: SegmentRevenueData[];
  isLoading?: boolean;
}

const chartConfig = {
  revenue: { label: 'Revenue' },
  platinum: { label: 'Platinum', color: 'hsl(270, 60%, 55%)' },
  gold: { label: 'Gold', color: 'hsl(45, 90%, 50%)' },
  silver: { label: 'Silver', color: 'hsl(220, 10%, 60%)' },
  bronze: { label: 'Bronze', color: 'hsl(25, 70%, 55%)' },
  inactive: { label: 'Inactive', color: 'hsl(0, 65%, 55%)' },
};

export function SegmentRevenueChart({ data, isLoading }: SegmentRevenueChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = data?.reduce((sum, d) => sum + d.revenue, 0) || 0;
  const topSegment = data?.reduce((max, d) => d.revenue > max.revenue ? d : max, { segment: '', revenue: 0, label: 'None', orderCount: 0, customerCount: 0, fill: '' });
  const totalOrders = data?.reduce((sum, d) => sum + d.orderCount, 0) || 0;
  const totalCustomers = data?.reduce((sum, d) => sum + d.customerCount, 0) || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium">Revenue by Customer Segment</CardTitle>
          <CardDescription>
            {formatRoundedINR(totalRevenue)} from {totalCustomers} customers across {totalOrders} orders
          </CardDescription>
        </div>
        {topSegment && topSegment.revenue > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Top Segment</p>
            <p className="text-sm font-semibold">{topSegment.label}</p>
            <p className="text-xs text-muted-foreground">{formatRoundedINR(topSegment.revenue)}</p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            No revenue data available
          </div>
        ) : (
          <div className="space-y-4">
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
                <XAxis type="number" tickFormatter={(v) => formatRoundedINR(v)} fontSize={12} />
                <YAxis type="category" dataKey="label" width={70} fontSize={12} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatRoundedINR(value as number)}
                    />
                  }
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={32}>
                  {data.map((entry) => (
                    <Cell key={entry.segment} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>

            {/* Summary cards */}
            <div className="grid grid-cols-5 gap-2">
              {data.map((seg) => {
                const pct = totalRevenue > 0 ? ((seg.revenue / totalRevenue) * 100).toFixed(1) : '0';
                return (
                  <div key={seg.segment} className="text-center p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.fill }} />
                      <span className="text-xs font-medium">{seg.label}</span>
                    </div>
                    <p className="text-sm font-bold">{pct}%</p>
                    <p className="text-[10px] text-muted-foreground">{seg.customerCount} customers</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

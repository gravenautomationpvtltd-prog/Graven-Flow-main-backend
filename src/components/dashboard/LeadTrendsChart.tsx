import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';
import type { LeadTrendData } from '@/hooks/useDashboardAnalytics';

interface LeadTrendsChartProps {
  data?: LeadTrendData[];
  isLoading?: boolean;
}

const chartConfig = {
  leads: {
    label: 'Total Leads',
    color: 'hsl(var(--primary))',
  },
  indiamart: {
    label: 'IndiaMART',
    color: 'hsl(var(--chart-1))',
  },
  tradeindia: {
    label: 'TradeIndia',
    color: 'hsl(var(--chart-2))',
  },
  manual: {
    label: 'Manual',
    color: 'hsl(var(--chart-3))',
  },
};

export function LeadTrendsChart({ data, isLoading }: LeadTrendsChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalLeads = data?.reduce((sum, d) => sum + d.leads, 0) || 0;
  const currentMonth = data?.[data.length - 1]?.leads || 0;
  const previousMonth = data?.[data.length - 2]?.leads || 0;
  const trend = previousMonth > 0 ? ((currentMonth - previousMonth) / previousMonth) * 100 : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium">Lead Trends</CardTitle>
          <CardDescription>Last 6 months lead volume</CardDescription>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-success" />
          <span className={trend >= 0 ? 'text-success' : 'text-destructive'}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No lead data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                tickLine={false} 
                axisLine={false}
                className="text-xs"
              />
              <YAxis 
                tickLine={false} 
                axisLine={false}
                className="text-xs"
                width={45}
                tickFormatter={(value) => {
                  if (value >= 1000) {
                    return `${(value / 1000).toFixed(1)}k`;
                  }
                  return value.toString();
                }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="leads"
                stroke="hsl(var(--primary))"
                fill="url(#fillLeads)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
        <div className="mt-2 text-center text-sm text-muted-foreground">
          {totalLeads} total leads in last 6 months
        </div>
      </CardContent>
    </Card>
  );
}

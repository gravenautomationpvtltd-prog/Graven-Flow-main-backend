import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Cell, Pie, PieChart, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeadSourceData } from '@/hooks/useDashboardAnalytics';

interface LeadSourceChartProps {
  data?: LeadSourceData[];
  isLoading?: boolean;
}

const chartConfig = {
  count: {
    label: 'Leads',
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
    color: 'hsl(var(--primary))',
  },
  whatsapp: {
    label: 'WhatsApp',
    color: 'hsl(var(--chart-4))',
  },
  website: {
    label: 'Website',
    color: 'hsl(var(--chart-5))',
  },
};

export function LeadSourceChart({ data, isLoading }: LeadSourceChartProps) {
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

  const totalLeads = data?.reduce((sum, d) => sum + d.count, 0) || 0;
  const topSource = data?.reduce((max, d) => d.count > max.count ? d : max, { source: '', count: 0, label: 'None', fill: '' });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium">Lead Sources</CardTitle>
          <CardDescription>Distribution by source</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">{topSource?.label}</div>
          <div className="text-xs text-muted-foreground">Top source</div>
        </div>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No source data available
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <ChartContainer config={chartConfig} className="h-[180px] w-[180px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex-1 space-y-2">
              {data.map((item) => {
                const percentage = totalLeads > 0 ? ((item.count / totalLeads) * 100).toFixed(1) : 0;
                return (
                  <div key={item.source} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="text-muted-foreground">{item.label}</span>
                    </div>
                    <span className="font-medium">{percentage}%</span>
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

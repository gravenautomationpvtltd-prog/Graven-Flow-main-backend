import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Cell, Pie, PieChart } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { ProcurementData } from '@/hooks/useDashboardAnalytics';

interface ProcurementStatusChartProps {
  data?: ProcurementData[];
  isLoading?: boolean;
}

const chartConfig = {
  count: {
    label: 'POs',
  },
};

export function ProcurementStatusChart({ data, isLoading }: ProcurementStatusChartProps) {
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

  const totalPOs = data?.reduce((sum, d) => sum + d.count, 0) || 0;
  const totalValue = data?.reduce((sum, d) => sum + d.value, 0) || 0;

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium">Procurement Status</CardTitle>
          <CardDescription>Purchase orders distribution</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{totalPOs}</div>
          <div className="text-xs text-muted-foreground">Total POs</div>
        </div>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No procurement data available
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
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex-1 space-y-2">
              {data.slice(0, 5).map((item) => (
                <div key={item.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-3 w-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-2 text-center text-sm text-muted-foreground">
          Total value: {formatCurrency(totalValue)}
        </div>
      </CardContent>
    </Card>
  );
}

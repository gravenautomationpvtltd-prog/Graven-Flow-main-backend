import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import type { PipelineData } from '@/hooks/useDashboardAnalytics';

interface SalesPipelineChartProps {
  data?: PipelineData[];
  isLoading?: boolean;
}

const chartConfig = {
  count: {
    label: 'Leads',
  },
};

export function SalesPipelineChart({ data, isLoading }: SalesPipelineChartProps) {
  const navigate = useNavigate();

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
  const wonLeads = data?.find(d => d.status === 'won')?.count || 0;
  const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

  const handleBarClick = (entry: PipelineData) => {
    navigate(`/leads?status=${entry.status}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium">Sales Pipeline</CardTitle>
          <CardDescription>Leads by status</CardDescription>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-success">{conversionRate.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground">Win rate</div>
        </div>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No pipeline data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart 
              data={data} 
              layout="vertical" 
              margin={{ top: 0, right: 10, left: 60, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="label" 
                tickLine={false} 
                axisLine={false}
                className="text-xs"
                width={60}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
              />
              <Bar 
                dataKey="count" 
                radius={[0, 4, 4, 0]}
                className="cursor-pointer"
                onClick={(_, index) => data[index] && handleBarClick(data[index])}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

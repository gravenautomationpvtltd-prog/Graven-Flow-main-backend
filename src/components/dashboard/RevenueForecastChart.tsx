import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Target, Percent } from 'lucide-react';

interface PipelineStage {
  stage: string;
  label: string;
  count: number;
  rawValue: number;
  probability: number;
  weightedValue: number;
  color: string;
}

interface RevenueForecastData {
  pipelineByStage: PipelineStage[];
  totalPipelineValue: number;
  weightedForecast: number;
  historicalWinRate: number;
}

interface RevenueForecastChartProps {
  data?: RevenueForecastData;
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
};

export function RevenueForecastChart({ data, isLoading }: RevenueForecastChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.pipelineByStage.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Revenue Forecast</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground">
          No pipeline data available for forecasting
        </CardContent>
      </Card>
    );
  }

  const chartConfig = {
    weightedValue: {
      label: 'Weighted Value',
    },
  };

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Revenue Forecast
          </CardTitle>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <Target className="h-3 w-3" />
              Pipeline
            </div>
            <div className="font-semibold text-sm">{formatCurrency(data.totalPipelineValue)}</div>
          </div>
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              Weighted
            </div>
            <div className="font-semibold text-sm text-primary">{formatCurrency(data.weightedForecast)}</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <Percent className="h-3 w-3" />
              Win Rate
            </div>
            <div className="font-semibold text-sm">{data.historicalWinRate.toFixed(0)}%</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.pipelineByStage}
              layout="vertical"
              margin={{ top: 5, right: 80, left: 10, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="label" 
                axisLine={false}
                tickLine={false}
                width={90}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      const stage = item.payload as PipelineStage;
                      return (
                        <div className="space-y-1">
                          <div className="font-medium">{stage.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {stage.count} deals • {stage.probability}% probability
                          </div>
                          <div className="text-xs">
                            Raw: {formatCurrency(stage.rawValue)}
                          </div>
                          <div className="text-xs font-medium text-primary">
                            Weighted: {formatCurrency(stage.weightedValue)}
                          </div>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar 
                dataKey="weightedValue" 
                radius={[0, 4, 4, 0]}
                maxBarSize={30}
              >
                {data.pipelineByStage.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="weightedValue"
                  position="right"
                  formatter={(value: number) => formatCurrency(value)}
                  style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
        
        {/* Probability Legend */}
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {data.pipelineByStage.slice(0, 5).map((stage) => (
            <div key={stage.stage} className="flex items-center gap-1 text-xs">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-muted-foreground">{stage.label}: {stage.probability}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

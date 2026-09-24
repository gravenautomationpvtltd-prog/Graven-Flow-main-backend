import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, XAxis, YAxis, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useSegmentAnalytics, type SegmentMetric, type SegmentMetricData } from '@/hooks/useSegmentAnalytics';
import { SegmentDrilldownDialog } from '@/components/dashboard/SegmentDrilldownDialog';
import { formatRoundedINR } from '@/lib/currency-utils';
import type { DateRange } from '@/hooks/useDashboardAnalytics';

interface SegmentAnalyticsCardProps {
  dateRange?: DateRange;
  userId?: string;
  isScoped?: boolean;
}

const METRIC_OPTIONS: { value: SegmentMetric; label: string }[] = [
  { value: 'customers', label: 'Customers' },
  { value: 'leads', label: 'Leads' },
  { value: 'enquiries', label: 'Enquiries' },
  { value: 'quotations', label: 'Quotations' },
  { value: 'conversions', label: 'Conversions' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'all_qualifiers', label: 'All Qualifiers' },
];

const chartConfig = {
  value: { label: 'Count' },
  platinum: { label: 'Platinum', color: 'hsl(270, 60%, 55%)' },
  gold: { label: 'Gold', color: 'hsl(45, 90%, 50%)' },
  silver: { label: 'Silver', color: 'hsl(220, 10%, 60%)' },
  bronze: { label: 'Bronze', color: 'hsl(25, 70%, 55%)' },
  inactive: { label: 'Inactive', color: 'hsl(0, 65%, 55%)' },
};

export function SegmentAnalyticsCard({ dateRange, userId, isScoped }: SegmentAnalyticsCardProps) {
  const [metric, setMetric] = useState<SegmentMetric>('customers');
  const [drilldown, setDrilldown] = useState<{ segment: string; label: string } | null>(null);
  const { data, isLoading } = useSegmentAnalytics({ dateRange, userId, isScoped });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const metricData: SegmentMetricData[] = data?.[metric] || [];
  const total = metricData.reduce((s, d) => s + d.value, 0);
  const topSegment = metricData.reduce((max, d) => d.value > max.value ? d : max, { segment: '', label: 'None', value: 0, fill: '' });
  const isRevenue = metric === 'revenue';
  const metricLabel = METRIC_OPTIONS.find(o => o.value === metric)?.label || 'Count';

  const formatValue = (v: number) => isRevenue ? formatRoundedINR(v) : v.toLocaleString();

  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload) {
      const entry = data.activePayload[0].payload as SegmentMetricData;
      if (entry.value > 0) {
        setDrilldown({ segment: entry.segment, label: entry.label });
      }
    }
  };

  const handleSegmentClick = (seg: SegmentMetricData) => {
    if (seg.value > 0) {
      setDrilldown({ segment: seg.segment, label: seg.label });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">Segment Analytics</CardTitle>
            <CardDescription>
              {isRevenue
                ? `${formatRoundedINR(total)} total revenue across segments`
                : `${total.toLocaleString()} ${metricLabel.toLowerCase()} across segments`}
            </CardDescription>
          </div>
          <Select value={metric} onValueChange={(v) => setMetric(v as SegmentMetric)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRIC_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              No {metricLabel.toLowerCase()} data available
            </div>
          ) : (
            <div className="space-y-4">
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart
                  data={metricData}
                  layout="vertical"
                  margin={{ left: 10, right: 30 }}
                  onClick={handleBarClick}
                  className="cursor-pointer"
                >
                  <XAxis
                    type="number"
                    tickFormatter={(v) => isRevenue ? formatRoundedINR(v) : v.toLocaleString()}
                    fontSize={12}
                  />
                  <YAxis type="category" dataKey="label" width={70} fontSize={12} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatValue(value as number)}
                      />
                    }
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={32}>
                    {metricData.map((entry) => (
                      <Cell key={entry.segment} fill={entry.fill} className="cursor-pointer" />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>

              {/* Summary cards */}
              <div className="grid grid-cols-5 gap-2">
                {metricData.map((seg) => {
                  const pct = total > 0 ? ((seg.value / total) * 100).toFixed(1) : '0';
                  return (
                    <div
                      key={seg.segment}
                      className="text-center p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => handleSegmentClick(seg)}
                    >
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.fill }} />
                        <span className="text-xs font-medium">{seg.label}</span>
                      </div>
                      <p className="text-sm font-bold">{pct}%</p>
                      <p className="text-[10px] text-muted-foreground">{formatValue(seg.value)}</p>
                    </div>
                  );
                })}
              </div>

              {topSegment.value > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Top segment: <span className="font-medium text-foreground">{topSegment.label}</span> — {formatValue(topSegment.value)} ({total > 0 ? ((topSegment.value / total) * 100).toFixed(1) : 0}%)
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {drilldown && (
        <SegmentDrilldownDialog
          open={!!drilldown}
          onOpenChange={(open) => !open && setDrilldown(null)}
          segment={drilldown.segment}
          segmentLabel={drilldown.label}
          metric={metric}
          metricLabel={metricLabel}
          dateRange={dateRange}
          userId={userId}
          isScoped={isScoped}
        />
      )}
    </>
  );
}

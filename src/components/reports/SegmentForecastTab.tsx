import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSegmentAnalytics } from '@/hooks/useSegmentAnalytics';
import { getSegmentConfig } from '@/lib/segment-config';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { TrendingUp, Users, IndianRupee, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SegmentDrilldownDialog } from '@/components/dashboard/SegmentDrilldownDialog';
import type { SegmentMetric } from '@/hooks/useSegmentAnalytics';
import type { DateRange } from '@/hooks/useDashboardAnalytics';

interface SegmentForecastTabProps {
  dateRange: DateRange;
}

const SEGMENT_COLORS: Record<string, string> = {
  platinum: 'hsl(270, 60%, 55%)',
  gold: 'hsl(45, 90%, 50%)',
  silver: 'hsl(220, 10%, 60%)',
  bronze: 'hsl(25, 70%, 55%)',
  inactive: 'hsl(0, 65%, 55%)',
};

const THRESHOLDS: Record<string, number> = {
  platinum: 2500000,
  gold: 1500000,
  silver: 800000,
  bronze: 300000,
  inactive: 0,
};

function formatCurrency(val: number) {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toFixed(0)}`;
}

export function SegmentForecastTab({ dateRange }: SegmentForecastTabProps) {
  const { data, isLoading } = useSegmentAnalytics({ dateRange });
  const [forecastSegments, setForecastSegments] = useState<Set<string>>(new Set(['platinum', 'gold', 'silver', 'bronze', 'inactive']));
  const [drilldown, setDrilldown] = useState<{ segment: string; metric: SegmentMetric } | null>(null);

  const openDrilldown = (segment: string, metric: SegmentMetric) => {
    setDrilldown({ segment, metric });
  };

  const segmentSummary = useMemo(() => {
    if (!data) return [];
    const segments = ['platinum', 'gold', 'silver', 'bronze', 'inactive'];
    return segments.map(seg => {
      const customerCount = data.customers.find(d => d.segment === seg)?.value ?? 0;
      const revenue = data.revenue.find(d => d.segment === seg)?.value ?? 0;
      const conversions = data.conversions.find(d => d.segment === seg)?.value ?? 0;
      const leads = data.leads.find(d => d.segment === seg)?.value ?? 0;
      const config = getSegmentConfig(seg);
      return {
        segment: seg,
        label: config.label,
        description: config.description,
        customers: customerCount,
        revenue,
        conversions,
        leads,
        avgRevenue: customerCount > 0 ? revenue / customerCount : 0,
        conversionRate: leads > 0 ? ((conversions / leads) * 100) : 0,
        // Forecast: annualize current period revenue
        annualForecast: revenue > 0 ? estimateAnnualFromRange(revenue, dateRange) : 0,
        fill: SEGMENT_COLORS[seg],
      };
    });
  }, [data, dateRange]);

  const totals = useMemo(() => {
    return {
      customers: segmentSummary.reduce((s, r) => s + r.customers, 0),
      revenue: segmentSummary.reduce((s, r) => s + r.revenue, 0),
      forecast: segmentSummary.reduce((s, r) => s + r.annualForecast, 0),
      conversions: segmentSummary.reduce((s, r) => s + r.conversions, 0),
    };
  }, [segmentSummary]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard icon={Users} label="Total Customers" value={totals.customers.toLocaleString()} />
        <KPICard icon={IndianRupee} label="Period Revenue" value={formatCurrency(totals.revenue)} />
        <KPICard icon={TrendingUp} label="Annual Forecast" value={formatCurrency(totals.forecast)} />
        <KPICard icon={Target} label="Total Conversions" value={totals.conversions.toLocaleString()} />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Customer Distribution Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Customer Distribution</CardTitle>
            <CardDescription>Customers by segment tier</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={segmentSummary.filter(s => s.customers > 0)}
                  dataKey="customers"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ label, customers }) => `${label}: ${customers}`}
                  className="cursor-pointer"
                  onClick={(_, index) => {
                    const filtered = segmentSummary.filter(s => s.customers > 0);
                    if (filtered[index]) openDrilldown(filtered[index].segment, 'customers');
                  }}
                >
                  {segmentSummary.filter(s => s.customers > 0).map((entry) => (
                    <Cell key={entry.segment} fill={entry.fill} className="cursor-pointer" />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => val.toLocaleString()} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Segment Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Segment</CardTitle>
            <CardDescription>Period revenue per tier</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={segmentSummary}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis tickFormatter={formatCurrency} className="text-xs" />
                <Tooltip formatter={(val: number) => formatCurrency(val)} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} className="cursor-pointer" onClick={(data: any) => {
                  if (data?.segment) openDrilldown(data.segment, 'revenue');
                }}>
                  {segmentSummary.map((entry) => (
                    <Cell key={entry.segment} fill={entry.fill} className="cursor-pointer" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Annual Forecast Bar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Annual Revenue Forecast by Segment
              </CardTitle>
              <CardDescription>Projected annual revenue based on current period performance</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {['platinum', 'gold', 'silver', 'bronze', 'inactive'].map(seg => {
                const config = getSegmentConfig(seg);
                const isActive = forecastSegments.has(seg);
                return (
                  <button
                    key={seg}
                    onClick={() => {
                      const next = new Set(forecastSegments);
                      if (next.has(seg)) next.delete(seg); else next.add(seg);
                      setForecastSegments(next);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      isActive ? config.badgeClass + ' opacity-100' : 'border-muted bg-muted/30 text-muted-foreground opacity-50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: SEGMENT_COLORS[seg] }} />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={segmentSummary.filter(s => forecastSegments.has(s.segment))}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis tickFormatter={formatCurrency} className="text-xs" />
              <Tooltip
                formatter={(val: number, name: string) => [formatCurrency(val), name === 'annualForecast' ? 'Annual Forecast' : 'Period Revenue']}
              />
              <Bar dataKey="revenue" name="Period Revenue" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} />
              <Bar dataKey="annualForecast" name="Annual Forecast" radius={[4, 4, 0, 0]}>
                {segmentSummary.filter(s => forecastSegments.has(s.segment)).map((entry) => (
                  <Cell key={entry.segment} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Segment Breakdown</CardTitle>
          <CardDescription>Detailed metrics per segment with annual potential thresholds</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">Segment</th>
                  <th className="text-left py-2 px-3 font-medium">Threshold</th>
                  <th className="text-right py-2 px-3 font-medium">Customers</th>
                  <th className="text-right py-2 px-3 font-medium">Leads</th>
                  <th className="text-right py-2 px-3 font-medium">Conversions</th>
                  <th className="text-right py-2 px-3 font-medium">Conv. Rate</th>
                  <th className="text-right py-2 px-3 font-medium">Period Revenue</th>
                  <th className="text-right py-2 px-3 font-medium">Avg/Customer</th>
                  <th className="text-right py-2 px-3 font-medium">Annual Forecast</th>
                </tr>
              </thead>
              <tbody>
                {segmentSummary.map(row => (
                  <tr key={row.segment} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => openDrilldown(row.segment, 'customers')}>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1.5`}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: row.fill }} />
                        <span className="font-medium">{row.label}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">{row.description}</td>
                    <td className="py-2.5 px-3 text-right font-medium hover:underline hover:text-primary" onClick={e => { e.stopPropagation(); openDrilldown(row.segment, 'customers'); }}>{row.customers.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right hover:underline hover:text-primary" onClick={e => { e.stopPropagation(); openDrilldown(row.segment, 'leads'); }}>{row.leads.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right hover:underline hover:text-primary" onClick={e => { e.stopPropagation(); openDrilldown(row.segment, 'conversions'); }}>{row.conversions.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right">{row.conversionRate.toFixed(1)}%</td>
                    <td className="py-2.5 px-3 text-right font-medium hover:underline hover:text-primary" onClick={e => { e.stopPropagation(); openDrilldown(row.segment, 'revenue'); }}>{formatCurrency(row.revenue)}</td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(row.avgRevenue)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold">{formatCurrency(row.annualForecast)}</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 font-semibold bg-muted/30">
                  <td className="py-2.5 px-3" colSpan={2}>Total</td>
                  <td className="py-2.5 px-3 text-right">{totals.customers.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right">{segmentSummary.reduce((s, r) => s + r.leads, 0).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right">{totals.conversions.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right">—</td>
                  <td className="py-2.5 px-3 text-right">{formatCurrency(totals.revenue)}</td>
                  <td className="py-2.5 px-3 text-right">—</td>
                  <td className="py-2.5 px-3 text-right">{formatCurrency(totals.forecast)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {drilldown && (
        <SegmentDrilldownDialog
          open={!!drilldown}
          onOpenChange={() => setDrilldown(null)}
          segment={drilldown.segment}
          segmentLabel={getSegmentConfig(drilldown.segment).label}
          metric={drilldown.metric}
          metricLabel={drilldown.metric.charAt(0).toUpperCase() + drilldown.metric.slice(1)}
          dateRange={dateRange}
        />
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value }: { icon: React.ComponentType<any>; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function estimateAnnualFromRange(periodRevenue: number, dateRange: { from?: Date; to?: Date }): number {
  const from = dateRange.from;
  const to = dateRange.to || new Date();
  if (!from) return periodRevenue; // no range = assume it's already ~annual
  const days = Math.max(1, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  return (periodRevenue / days) * 365;
}

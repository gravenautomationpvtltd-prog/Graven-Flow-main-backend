import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { useAuth } from '@/hooks/useAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { useOrderStats, DateRange } from '@/hooks/useOrderAnalytics';
import { OrderAnalyticsCharts } from '@/components/orders/OrderAnalyticsCharts';
import { 
  BarChart3, 
  TrendingUp, 
  IndianRupee, 
  Percent, 
  Target,
  ShoppingCart,
  XCircle,
  PauseCircle
} from 'lucide-react';

type DatePreset = 'all_time' | 'this_month' | 'last_month' | 'last_30_days' | 'last_90_days' | 'this_year' | 'last_year' | 'custom';

function getDateRange(preset: DatePreset, customFrom?: Date, customTo?: Date): DateRange {
  if (preset === 'custom') {
    return { from: customFrom || null, to: customTo || null };
  }
  if (preset === 'all_time') {
    return { from: null, to: null };
  }
  
  const today = new Date();
  switch (preset) {
    case 'this_month':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: new Date(today.getFullYear(), today.getMonth() + 1, 0) };
    case 'last_month':
      return { from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: new Date(today.getFullYear(), today.getMonth(), 0) };
    case 'last_30_days':
      return { from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), to: today };
    case 'last_90_days':
      return { from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), to: today };
    case 'this_year':
      return { from: new Date(today.getFullYear(), 0, 1), to: new Date(today.getFullYear(), 11, 31) };
    case 'last_year':
      return { from: new Date(today.getFullYear() - 1, 0, 1), to: new Date(today.getFullYear() - 1, 11, 31) };
    default:
      return { from: null, to: null };
  }
}

export default function OrderAnalytics() {
  const { isManager, isAdmin } = useAuth();
  const { data: profiles } = useProfiles();
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('last_90_days');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  
  const dateRange = getDateRange(datePreset, customFrom, customTo);
  
  const { data: stats, isLoading } = useOrderStats(
    selectedUserId !== 'all' ? selectedUserId : undefined,
    dateRange
  );

  const salesProfiles = profiles?.filter(p => p.is_active) || [];

  const kpiCards = [
    {
      title: 'Average Order Value',
      value: stats?.avgOrderValue ? `₹${Math.round(stats.avgOrderValue).toLocaleString()}` : '₹0',
      icon: ShoppingCart,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Collection Rate',
      value: stats?.collectionRate ? `${stats.collectionRate.toFixed(1)}%` : '0%',
      icon: Percent,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Revenue',
      value: stats?.totalValue ? `₹${(stats.totalValue / 100000).toFixed(1)}L` : '₹0',
      icon: IndianRupee,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Fulfillment Rate',
      value: stats && stats.totalOrders > 0 
        ? `${((stats.fulfilledOrders / stats.totalOrders) * 100).toFixed(0)}%` 
        : '0%',
      icon: Target,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Cancelled',
      value: stats?.cancelledOrders?.toString() || '0',
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Postponed',
      value: stats?.postponedOrders?.toString() || '0',
      icon: PauseCircle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <>
      <Helmet>
        <title>Order Analytics | Graven</title>
        <meta name="description" content="Sales order analytics and performance metrics" />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Order Analytics</h1>
                <p className="text-muted-foreground">
                  Performance metrics and order insights
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter
                datePreset={datePreset}
                onDatePresetChange={setDatePreset}
                customFrom={customFrom}
                customTo={customTo}
                onCustomFromChange={setCustomFrom}
                onCustomToChange={setCustomTo}
              />
              
              {(isManager || isAdmin) && (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Team Members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team Members</SelectItem>
                    {salesProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpiCards.map((kpi) => (
            <Card key={kpi.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{kpi.value}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <OrderAnalyticsCharts 
          userId={selectedUserId !== 'all' ? selectedUserId : undefined} 
          dateRange={dateRange}
        />
      </div>
    </>
  );
}

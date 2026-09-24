import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEmployeeProfile, useEmployeeStats } from '@/hooks/useEmployeeStats';
import { useEmployeeDetailedStats } from '@/hooks/useEmployeeDetailedStats';
import { DateRangeFilter, DatePreset, getDateRangeFromPreset } from '@/components/ui/date-range-filter';
import { PercentChangeIndicator } from '@/components/ui/percent-change-indicator';
import { getPreviousPeriod, calcPercentChange } from '@/lib/period-comparison';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AccessDenied } from '@/components/ui/access-denied';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EmployeeDetailHeader } from '@/components/employees/EmployeeDetailHeader';
import { EmployeeLeadsTable } from '@/components/employees/EmployeeLeadsTable';
import { EmployeeCustomersTable } from '@/components/employees/EmployeeCustomersTable';
import { EmployeeOrdersTable } from '@/components/employees/EmployeeOrdersTable';
import { EmployeeTasksTable } from '@/components/employees/EmployeeTasksTable';
import { EmployeeAttendanceTab } from '@/components/employees/EmployeeAttendanceTab';
import { EmployeePerformanceTab } from '@/components/employees/EmployeePerformanceTab';
import { EmployeeWinLossAnalytics } from '@/components/employees/EmployeeWinLossAnalytics';
import { EmployeeQuotationsTable } from '@/components/employees/EmployeeQuotationsTable';
import { EmployeeDealsTable } from '@/components/employees/EmployeeDealsTable';
import { EmployeeProductPerformance } from '@/components/employees/EmployeeProductPerformance';
import { SalespersonQuotationWidget } from '@/components/dashboard/SalespersonQuotationWidget';
import { formatRoundedINR } from '@/lib/currency-utils';
import { 
  Target, Users, ShoppingCart, IndianRupee, TrendingUp,
  ArrowLeft, Trophy, XCircle, FileText
} from 'lucide-react';

type TabValue = 'sales-analytics' | 'deals' | 'quotations' | 'products' | 'leads' | 'customers' | 'orders' | 'tasks' | 'attendance' | 'performance';

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabValue>('sales-analytics');
  const [dealsFilter, setDealsFilter] = useState<'all' | 'won' | 'lost'>('all');

  // Date range filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('all_time');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const dateRange = getDateRangeFromPreset(datePreset, customFrom, customTo);
  
  // Compute previous period for comparison (only when a specific period is selected)
  const hasDateRange = datePreset !== 'all_time' && dateRange.from && dateRange.to;
  const prevDateRange = useMemo(
    () => hasDateRange ? getPreviousPeriod(dateRange) : {},
    [dateRange.from?.getTime(), dateRange.to?.getTime(), hasDateRange]
  );

  const { data: profile, isLoading: profileLoading } = useEmployeeProfile(id || '');
  const { data: stats, isLoading: statsLoading } = useEmployeeStats(id || '', dateRange);
  const { data: prevStats } = useEmployeeStats(
    hasDateRange ? (id || '') : '',
    prevDateRange
  );
  const { data: detailedStats, isLoading: detailedStatsLoading } = useEmployeeDetailedStats(id || '', dateRange);
  const { data: prevDetailedStats } = useEmployeeDetailedStats(
    hasDateRange ? (id || '') : '',
    prevDateRange
  );

  const { roles: userRoles } = useAuth();
  const canViewEmployees = isAdmin || userRoles.includes('hr') || userRoles.includes('coo');

  if (!canViewEmployees) {
    return <AccessDenied />;
  }

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h2 className="text-xl font-bold">Employee Not Found</h2>
        <p className="text-muted-foreground">The requested employee profile does not exist.</p>
      </div>
    );
  }

  const handleCardClick = (tab: TabValue, filter?: 'all' | 'won' | 'lost') => {
    setActiveTab(tab);
    if (filter) setDealsFilter(filter);
  };

  // Helper to get % change - returns null when no comparison available
  const pctChange = (current: number, previous: number | undefined) => {
    if (!hasDateRange || previous === undefined) return null;
    return calcPercentChange(current, previous);
  };

  return (
    <div className="space-y-6">
      <EmployeeDetailHeader profile={profile} />

      {/* Date Range Filter */}
      <div className="flex justify-end">
        <DateRangeFilter
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          showAllTime
        />
      </div>

      {/* Quick Stats Row - Interactive Cards */}
      <TooltipProvider>
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all" onClick={() => handleCardClick('leads')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Leads</CardTitle>
                  <Target className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <div className="flex items-end gap-2">
                      <div className="text-xl lg:text-2xl font-bold">{stats?.leadCount || 0}</div>
                      <PercentChangeIndicator value={pctChange(stats?.leadCount || 0, prevStats?.leadCount)} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              {hasDateRange && prevStats ? `Previous: ${prevStats.leadCount}` : 'Click to view all leads'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all" onClick={() => handleCardClick('customers')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Customers</CardTitle>
                  <Users className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <div className="flex items-end gap-2">
                      <div className="text-xl lg:text-2xl font-bold">{stats?.customerCount || 0}</div>
                      <PercentChangeIndicator value={pctChange(stats?.customerCount || 0, prevStats?.customerCount)} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              {hasDateRange && prevStats ? `Previous: ${prevStats.customerCount}` : 'Click to view all customers'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all" onClick={() => handleCardClick('orders')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <div className="flex items-end gap-2">
                      <div className="text-xl lg:text-2xl font-bold">{stats?.orderCount || 0}</div>
                      <PercentChangeIndicator value={pctChange(stats?.orderCount || 0, prevStats?.orderCount)} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              {hasDateRange && prevStats ? `Previous: ${prevStats.orderCount}` : 'Click to view all orders'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all" onClick={() => handleCardClick('orders')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Revenue</CardTitle>
                  <IndianRupee className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <div>
                      <div className="text-lg lg:text-xl font-bold truncate" title={`₹${(stats?.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}>
                        {formatRoundedINR(stats?.totalRevenue || 0)}
                      </div>
                      <PercentChangeIndicator value={pctChange(stats?.totalRevenue || 0, prevStats?.totalRevenue)} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              {hasDateRange && prevStats
                ? `Previous: ₹${(prevStats.totalRevenue || 0).toLocaleString('en-IN')}`
                : `Exact: ₹${(stats?.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
              }
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer hover:border-green-500 hover:shadow-md transition-all" onClick={() => handleCardClick('deals', 'won')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Won</CardTitle>
                  <Trophy className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  {detailedStatsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <div className="flex items-end gap-2">
                      <div className="text-xl lg:text-2xl font-bold text-green-600">{detailedStats?.wonCount || 0}</div>
                      <PercentChangeIndicator value={pctChange(detailedStats?.wonCount || 0, prevDetailedStats?.wonCount)} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              {hasDateRange && prevDetailedStats ? `Previous: ${prevDetailedStats.wonCount}` : 'Click to view won deals'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer hover:border-red-500 hover:shadow-md transition-all" onClick={() => handleCardClick('deals', 'lost')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Lost</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  {detailedStatsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <div className="flex items-end gap-2">
                      <div className="text-xl lg:text-2xl font-bold text-red-600">{detailedStats?.lostCount || 0}</div>
                      <PercentChangeIndicator value={pctChange(detailedStats?.lostCount || 0, prevDetailedStats?.lostCount)} invertColor />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              {hasDateRange && prevDetailedStats ? `Previous: ${prevDetailedStats.lostCount}` : 'Click to view lost deals'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all" onClick={() => handleCardClick('sales-analytics')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Win Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-teal-500" />
                </CardHeader>
                <CardContent>
                  {detailedStatsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <div className="flex items-end gap-2">
                      <div className="text-xl lg:text-2xl font-bold">{Math.round(detailedStats?.winRate || 0)}%</div>
                      <PercentChangeIndicator value={pctChange(detailedStats?.winRate || 0, prevDetailedStats?.winRate)} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              {hasDateRange && prevDetailedStats ? `Previous: ${Math.round(prevDetailedStats.winRate)}%` : 'Click to view sales analytics'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all" onClick={() => handleCardClick('quotations')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Quotations</CardTitle>
                  <FileText className="h-4 w-4 text-cyan-500" />
                </CardHeader>
                <CardContent>
                  {statsLoading ? <Skeleton className="h-8 w-16" /> : (
                    <div className="flex items-end gap-2">
                      <div className="text-xl lg:text-2xl font-bold">{stats?.quotationCount || 0}</div>
                      <PercentChangeIndicator value={pctChange(stats?.quotationCount || 0, prevStats?.quotationCount)} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              {hasDateRange && prevStats ? `Previous: ${prevStats.quotationCount}` : 'Click to view all quotations'}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Quotation Performance Widget */}
      <SalespersonQuotationWidget userId={id || ''} userName={profile.full_name} dateRange={dateRange} />

      {/* Tabs for detailed data */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="sales-analytics">Sales Analytics</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="sales-analytics" className="space-y-4">
          <EmployeeWinLossAnalytics stats={detailedStats} isLoading={detailedStatsLoading} onNavigateToDeals={(filter) => handleCardClick('deals', filter)} />
        </TabsContent>

        <TabsContent value="deals" className="space-y-4">
          <EmployeeDealsTable deals={detailedStats?.deals} isLoading={detailedStatsLoading} initialFilter={dealsFilter} />
        </TabsContent>

        <TabsContent value="quotations" className="space-y-4">
          <EmployeeQuotationsTable employeeId={id || ''} dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <EmployeeProductPerformance products={detailedStats?.productPerformance} isLoading={detailedStatsLoading} />
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Assigned Leads</CardTitle></CardHeader>
            <CardContent>
              <EmployeeLeadsTable employeeId={id || ''} dateRange={dateRange} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Assigned Customers</CardTitle></CardHeader>
            <CardContent>
              <EmployeeCustomersTable employeeId={id || ''} dateRange={dateRange} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Orders from Leads</CardTitle></CardHeader>
            <CardContent>
              <EmployeeOrdersTable employeeId={id || ''} dateRange={dateRange} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Assigned Tasks</CardTitle></CardHeader>
            <CardContent>
              <EmployeeTasksTable employeeId={id || ''} dateRange={dateRange} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <EmployeeAttendanceTab employeeId={id || ''} dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <EmployeePerformanceTab stats={stats} isLoading={statsLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

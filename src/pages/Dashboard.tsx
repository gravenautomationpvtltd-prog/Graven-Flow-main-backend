import { useState, useEffect } from 'react';
import { LeadsDrilldownDialog } from '@/components/dashboard/LeadsDrilldownDialog';
import { RevenueDrilldownDialog } from '@/components/dashboard/RevenueDrilldownDialog';
import { CustomersDrilldownDialog } from '@/components/dashboard/CustomersDrilldownDialog';
import { QuotationsDrilldownDialog } from '@/components/dashboard/QuotationsDrilldownDialog';
import { DealsWonDrilldownDialog } from '@/components/dashboard/DealsWonDrilldownDialog';
import { DraftPOsDrilldownDialog } from '@/components/dashboard/DraftPOsDrilldownDialog';
import { PendingPOsDrilldownDialog } from '@/components/dashboard/PendingPOsDrilldownDialog';
import { LowStockDrilldownDialog } from '@/components/dashboard/LowStockDrilldownDialog';
import { SuppliersDrilldownDialog } from '@/components/dashboard/SuppliersDrilldownDialog';
import { InventoryDrilldownDialog } from '@/components/dashboard/InventoryDrilldownDialog';
import { ReceivablesDrilldownDialog } from '@/components/dashboard/ReceivablesDrilldownDialog';
import { OverduePaymentsDrilldownDialog } from '@/components/dashboard/OverduePaymentsDrilldownDialog';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  DollarSign,
  IndianRupee,
  Package,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  FileCheck,
  CheckCircle,
  Shield,
  ClipboardList,
  Warehouse,
  Truck,
  UserPlus,
  FileText,
  PackagePlus,
  Receipt,
  CreditCard,
  CircleDollarSign,
  AlertCircle,
} from 'lucide-react';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useSalesStats, useProcurementStats, usePendingApprovals, useDashboardRealtime } from '@/hooks/useDashboardStats';
import { useDashboardAnalytics } from '@/hooks/useDashboardAnalytics';
import { LeadTrendsChart } from '@/components/dashboard/LeadTrendsChart';
import { SalesPipelineChart } from '@/components/dashboard/SalesPipelineChart';
import { ProcurementStatusChart } from '@/components/dashboard/ProcurementStatusChart';
import { LeadSourceChart } from '@/components/dashboard/LeadSourceChart';
import { RevenueForecastChart } from '@/components/dashboard/RevenueForecastChart';
import { SegmentRevenueChart } from '@/components/dashboard/SegmentRevenueChart';
import { useSegmentRevenue } from '@/hooks/useSegmentRevenue';
import { SegmentAnalyticsCard } from '@/components/dashboard/SegmentAnalyticsCard';
import { MyEscalationsCard } from '@/components/escalations/MyEscalationsCard';
import { RecentlyResolvedPricesWidget } from '@/components/dashboard/RecentlyResolvedPricesWidget';
import { DuplicateLeadsWidget } from '@/components/dashboard/DuplicateLeadsWidget';
import { DateRangeFilter, type DatePreset, getDateRangeFromPreset } from '@/components/ui/date-range-filter';
import { SalespersonQuotationWidget } from '@/components/dashboard/SalespersonQuotationWidget';
import { PaymentCollectionChart } from '@/components/dashboard/PaymentCollectionChart';
import { ReceivablesAgingChart } from '@/components/dashboard/ReceivablesAgingChart';
import { TopOutstandingCustomersChart } from '@/components/dashboard/TopOutstandingCustomersChart';
import { useAccountsStats } from '@/hooks/useAccountsDashboard';
import { useTranslation } from '@/lib/i18n';
import { useInView } from '@/hooks/useInView';
import { useDashboardScope } from '@/hooks/useDashboardScope';
import { DashboardScopeToggle } from '@/components/dashboard/DashboardScopeToggle';

function getPeriodLabel(preset: DatePreset): string {
  const labels: Record<string, string> = {
    today: 'today',
    yesterday: 'yesterday',
    this_week: 'this week',
    last_week: 'last week',
    this_month: 'this month',
    last_month: 'last month',
    this_quarter: 'this quarter',
    last_quarter: 'last quarter',
    this_year: 'this year',
    last_year: 'last year',
    all_time: 'all time',
    custom: 'in period',
  };
  return labels[preset] || 'in period';
}

import ProcurementManagerDashboard from '@/pages/dashboards/ProcurementManagerDashboard';
import ProcurementExecutiveDashboard from '@/pages/dashboards/ProcurementExecutiveDashboard';

export default function Dashboard() {
  const { isAdmin, isSalesManager, isProcurementManager, isManager, isSales, isAccounts, isWarehouse, isCRO, isCST, isTST, isHR, isPureBIE, hasRole } = useAuth();
  // BIE-only staff and managers get their own workspace, never the company-wide dashboard
  if (isPureBIE) {
    return <Navigate to="/bie/dashboard" replace />;
  }
  // Procurement Manager (without admin/sales-manager override) gets a dedicated dashboard
  if (isProcurementManager && !isAdmin && !isSalesManager) {
    return <ProcurementManagerDashboard />;
  }
  // Pure Procurement executive (procurement role, NOT a manager/admin/sales/etc.) → self-scoped dashboard
  const isPureProcurementExecutive =
    hasRole('procurement') &&
    !isAdmin &&
    !isManager &&
    !isProcurementManager &&
    !isSalesManager &&
    !isSales &&
    !isAccounts &&
    !isWarehouse &&
    !isCRO &&
    !isCST &&
    !isTST &&
    !isHR;
  if (isPureProcurementExecutive) {
    return <ProcurementExecutiveDashboard />;
  }
  return <FullDashboard />;
}

function FullDashboard() {
  const [datePreset, setDatePreset] = useState<DatePreset>('all_time');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(getDateRangeFromPreset('all_time'));
  const [activeDrilldown, setActiveDrilldown] = useState<string | null>(null);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const { user, profile, roles, isAdmin, isManager, isProcurementManager, isSales, isProcurement, isWarehouse, isAccounts, isCRO, isCST, isTST } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Role-based landing redirects: pure-CRO → LQT Inbox, pure-CST → /customer-success, pure-TST → /tst
  useEffect(() => {
    if (!roles || roles.length === 0) return;
    const isPureRole = (flag: boolean) =>
      flag && !isAdmin && !isManager && !isSales && !isProcurement && !isWarehouse && !isAccounts;
    if (isPureRole(isCRO) && !isCST && !isTST) {
      navigate('/lqt-inbox', { replace: true });
    } else if (isPureRole(isCST) && !isCRO && !isTST) {
      navigate('/customer-success', { replace: true });
    } else if (isPureRole(isTST) && !isCRO && !isCST) {
      navigate('/tst', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.join(',')]);

  const canSeeApprovals = isManager || isAdmin;
  const isManagerOrAdmin = isManager || isAdmin;
  // Inclusive role flags — multi-role users see combined content
  const showSalesDashboard = isSales || isManagerOrAdmin;
  const showProcurementDashboard = isProcurement || isWarehouse || isProcurementManager || isAdmin;
  const showAccountsDashboard = isAccounts;
  const showCRODashboard = isCRO;

  // Deferred loading for below-fold content
  const { ref: chartsRef, isInView: chartsInView } = useInView();
  const { ref: widgetsRef, isInView: widgetsInView } = useInView();

  // Scope: "My work" (personal) vs "My team" (manager view).
  const scope = useDashboardScope();
  const scopedAssignedTo = scope.assignedTo;

  // Fetch chart analytics data only when charts section is in view
  const { leadTrends, salesPipeline, procurementStatus, leadSources, revenueForecast, isLoading: analyticsLoading } = useDashboardAnalytics(dateRange, chartsInView, scopedAssignedTo);
  const { data: segmentRevenue, isLoading: segmentLoading } = useSegmentRevenue(
    dateRange,
    scopedAssignedTo,
    chartsInView && showSalesDashboard,
  );
  const { data: accountsStats } = useAccountsStats(dateRange, showAccountsDashboard);

  // Use cached query hooks — enable based on inclusive role flags
  const { data: stats, isLoading: salesLoading } = useSalesStats(dateRange, showSalesDashboard, scopedAssignedTo);
  const { data: procurementStats, isLoading: procLoading } = useProcurementStats(dateRange, showProcurementDashboard);
  const { data: pendingApprovals } = usePendingApprovals(canSeeApprovals);
  const loading = salesLoading || procLoading;

  // Debounced realtime invalidation
  useDashboardRealtime({
    enableSales: showSalesDashboard,
    enableProcurement: showProcurementDashboard,
    enableApprovals: canSeeApprovals,
  });
  // Sales stat cards with dynamic labels based on selected period
  const periodLabel = getPeriodLabel(datePreset);
  const s = stats || { totalLeads: 0, newLeadsToday: 0, totalRevenue: 0, totalCustomers: 0, pendingQuotationsValue: 0, wonThisMonth: 0 };
  const p = procurementStats || { draftPOs: 0, pendingPOs: 0, lowStockAlerts: 0, totalSuppliers: 0, totalInventoryItems: 0 };
  const pa = pendingApprovals || { pendingVerification: 0, pendingAuthorization: 0, pendingApproval: 0 };
  const salesStatCards = [
    {
      title: 'Total Leads',
      value: s.totalLeads,
      change: datePreset === 'all_time' ? s.newLeadsToday : null,
      changeLabel: datePreset === 'all_time' ? 'new today' : periodLabel,
      icon: TrendingUp,
      trend: 'up',
      color: 'text-lead-new',
      bgColor: 'bg-lead-new/10',
      url: '/leads',
    },
    {
      title: 'Total Revenue',
      value: s.totalRevenue >= 10000000
        ? `₹${(s.totalRevenue / 10000000).toFixed(1)}Cr`
        : s.totalRevenue >= 100000
        ? `₹${(s.totalRevenue / 100000).toFixed(1)}L`
        : `₹${Math.round(s.totalRevenue).toLocaleString('en-IN')}`,
      change: null,
      changeLabel: datePreset === 'all_time' ? 'payments received' : periodLabel,
      icon: IndianRupee,
      trend: s.totalRevenue > 0 ? 'up' : 'neutral',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      url: '/order-analytics',
      isFormattedValue: true,
    },
    {
      title: 'Total Customers',
      value: s.totalCustomers,
      change: null,
      changeLabel: datePreset === 'all_time' ? 'in database' : periodLabel,
      icon: Users,
      trend: 'neutral',
      color: 'text-info',
      bgColor: 'bg-info/10',
      url: '/customers',
    },
    {
      title: 'Pending Quotations',
      value: s.pendingQuotationsValue >= 10000000
        ? `₹${(s.pendingQuotationsValue / 10000000).toFixed(1)}Cr`
        : s.pendingQuotationsValue >= 100000
        ? `₹${(s.pendingQuotationsValue / 100000).toFixed(1)}L`
        : `₹${Math.round(s.pendingQuotationsValue).toLocaleString('en-IN')}`,
      change: null,
      changeLabel: datePreset === 'all_time' ? 'active quotations' : periodLabel,
      icon: FileText,
      trend: s.pendingQuotationsValue > 0 ? 'up' : 'neutral',
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      url: '/quotations',
      isFormattedValue: true,
    },
    {
      title: 'Deals Won',
      value: s.wonThisMonth,
      change: null,
      changeLabel: periodLabel,
      icon: DollarSign,
      trend: 'up',
      color: 'text-success',
      bgColor: 'bg-success/10',
      url: '/leads?status=won',
    },
  ];

  // Procurement stat cards with dynamic labels based on selected period
  const procurementStatCards = [
    {
      title: 'Draft POs',
      value: p.draftPOs,
      change: null,
      changeLabel: datePreset === 'all_time' ? 'to be submitted' : periodLabel,
      icon: FileText,
      trend: 'neutral',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      url: '/procurement?status=draft',
    },
    {
      title: 'Pending POs',
      value: p.pendingPOs,
      change: null,
      changeLabel: datePreset === 'all_time' ? 'awaiting approval' : periodLabel,
      icon: ClipboardList,
      trend: p.pendingPOs > 0 ? 'warning' : 'neutral',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      url: '/procurement',
    },
    {
      title: 'Low Stock Alerts',
      value: p.lowStockAlerts,
      change: null,
      changeLabel: 'items need restock',
      icon: AlertTriangle,
      trend: p.lowStockAlerts > 0 ? 'warning' : 'neutral',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      url: '/inventory',
    },
    {
      title: 'Active Suppliers',
      value: p.totalSuppliers,
      change: null,
      changeLabel: 'in database',
      icon: Truck,
      trend: 'neutral',
      color: 'text-info',
      bgColor: 'bg-info/10',
      url: '/procurement?tab=suppliers',
    },
    {
      title: 'Inventory Items',
      value: p.totalInventoryItems,
      change: null,
      changeLabel: 'tracked',
      icon: Warehouse,
      trend: 'neutral',
      color: 'text-success',
      bgColor: 'bg-success/10',
      url: '/inventory',
    },
  ];

  // Accounts stat cards
  const formatInr = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    return `₹${Math.round(v).toLocaleString('en-IN')}`;
  };

  const accountsStatCards = [
    {
      title: 'Total Receivables',
      value: formatInr(accountsStats?.totalReceivables || 0),
      change: null,
      changeLabel: 'outstanding balance',
      icon: IndianRupee,
      trend: (accountsStats?.totalReceivables || 0) > 0 ? 'warning' : 'neutral',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      url: '/accounts',
      isFormattedValue: true,
    },
    {
      title: 'Payments Received',
      value: formatInr(accountsStats?.paymentsReceived || 0),
      change: null,
      changeLabel: datePreset === 'all_time' ? 'total collected' : periodLabel,
      icon: CreditCard,
      trend: 'up',
      color: 'text-success',
      bgColor: 'bg-success/10',
      url: '/accounts',
      isFormattedValue: true,
    },
    {
      title: 'Pending Invoices',
      value: accountsStats?.pendingInvoices || 0,
      change: null,
      changeLabel: 'not fully paid',
      icon: Receipt,
      trend: (accountsStats?.pendingInvoices || 0) > 0 ? 'warning' : 'neutral',
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
      url: '/invoices',
    },
    {
      title: 'Overdue Payments',
      value: accountsStats?.overdueOrders || 0,
      change: null,
      changeLabel: 'past due date',
      icon: AlertCircle,
      trend: (accountsStats?.overdueOrders || 0) > 0 ? 'warning' : 'neutral',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      url: '/accounts',
    },
    {
      title: 'Total Customers',
      value: accountsStats?.totalCustomers || 0,
      change: null,
      changeLabel: 'with orders',
      icon: Users,
      trend: 'neutral',
      color: 'text-info',
      bgColor: 'bg-info/10',
      url: '/accounts',
    },
  ];

  // Determine which stat cards to show — combine for multi-role users
  const getStatCards = () => {
    const cards: typeof salesStatCards = [];
    if (showAccountsDashboard) cards.push(...accountsStatCards);
    if (showProcurementDashboard && !isManagerOrAdmin) cards.push(...procurementStatCards);
    if (showSalesDashboard) cards.push(...salesStatCards);
    // If only accounts+CRO (no sales/procurement), show accounts cards
    if (cards.length === 0) return salesStatCards;
    // Deduplicate by title (e.g. both accounts and sales have "Total Customers")
    const seen = new Set<string>();
    return cards.filter(c => { if (seen.has(c.title)) return false; seen.add(c.title); return true; });
  };

  // Get welcome message based on role — combine for multi-role users
  const getWelcomeSubtitle = () => {
    const parts: string[] = [];
    if (showAccountsDashboard) parts.push('finance & receivables');
    if (showCRODashboard) parts.push('CRO');
    if (showSalesDashboard && !isManagerOrAdmin) parts.push('sales pipeline');
    if (showProcurementDashboard && !isManagerOrAdmin) parts.push('procurement & inventory');
    if (isManagerOrAdmin) parts.push('business');
    if (parts.length === 0) return "Here's what's happening today.";
    return `Here's your ${parts.join(', ')} overview.`;
  };


  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section with Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-display font-bold">
            {t('dashboard.welcome', 'Welcome back')}, {profile?.full_name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-muted-foreground">
            {getWelcomeSubtitle()}
            {scope.canToggle && scope.isPersonal && (
              <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Showing only leads assigned to you
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {scope.canToggle && (
            <DashboardScopeToggle mode={scope.mode} onChange={scope.setMode} />
          )}
          <DateRangeFilter
            datePreset={datePreset}
            onDatePresetChange={setDatePreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            showAllTime={true}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {getStatCards().map((stat) => (
          <Card 
            key={stat.title} 
            className="stat-card hover:border-primary/30 transition-all cursor-pointer hover:shadow-md"
            onClick={() => setActiveDrilldown(stat.title)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{stat.value}</div>
              {stat.change !== null && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {stat.trend === 'up' && <ArrowUpRight className="h-3 w-3 text-success" />}
                  {stat.trend === 'down' && <ArrowDownRight className="h-3 w-3 text-destructive" />}
                  <span className={stat.trend === 'up' ? 'text-success' : stat.trend === 'down' ? 'text-destructive' : ''}>
                    +{stat.change}
                  </span>
                  {stat.changeLabel}
                </p>
              )}
              {stat.change === null && (
                <p className="text-xs text-muted-foreground mt-1">{stat.changeLabel}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section — deferred until scrolled into view */}
      <div ref={chartsRef} className="grid gap-6 lg:grid-cols-2">
        {!chartsInView ? (
          <>
            <Card><CardContent className="pt-6"><Skeleton className="h-[300px]" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-[300px]" /></CardContent></Card>
          </>
        ) : (
          <>
            {/* Accounts Charts */}
            {showAccountsDashboard && (
              <>
                <PaymentCollectionChart enabled={chartsInView} />
                <ReceivablesAgingChart />
                <TopOutstandingCustomersChart />
              </>
            )}

            {showSalesDashboard && (
              <LeadTrendsChart data={leadTrends} isLoading={analyticsLoading} />
            )}
            {showSalesDashboard && (
              <SalesPipelineChart data={salesPipeline} isLoading={analyticsLoading} />
            )}
            {showSalesDashboard && (
              <RevenueForecastChart data={revenueForecast} isLoading={analyticsLoading} />
            )}
            {showProcurementDashboard && (
              <ProcurementStatusChart data={procurementStatus} isLoading={analyticsLoading} />
            )}
            {showSalesDashboard && (
              <LeadSourceChart data={leadSources} isLoading={analyticsLoading} />
            )}
            {showSalesDashboard && (
              <SegmentRevenueChart data={segmentRevenue} isLoading={segmentLoading} />
            )}
            {showSalesDashboard && (
              <SegmentAnalyticsCard
                dateRange={dateRange}
                userId={profile?.id}
                isScoped={showSalesDashboard}
              />
            )}
          </>
        )}
      </div>

      {/* Widgets — deferred until scrolled into view */}
      <div ref={widgetsRef}>
        {widgetsInView ? (
          <>
            {showSalesDashboard && profile?.id && (
              <SalespersonQuotationWidget userId={profile.id} userName={profile.full_name || undefined} dateRange={dateRange} />
            )}

            {showSalesDashboard && (
              <MyEscalationsCard />
            )}

            {showProcurementDashboard && (
              <RecentlyResolvedPricesWidget />
            )}

            {isManagerOrAdmin && (
              <DuplicateLeadsWidget />
            )}
          </>
        ) : (
          <Card><CardContent className="pt-6"><Skeleton className="h-[200px]" /></CardContent></Card>
        )}
      </div>
      {canSeeApprovals && (pa.pendingVerification > 0 || pa.pendingAuthorization > 0 || pa.pendingApproval > 0) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Pending Approvals</CardTitle>
                  <CardDescription>Purchase orders awaiting your action</CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {pa.pendingVerification + pa.pendingAuthorization + pa.pendingApproval}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                onClick={() => navigate('/procurement?status=pending_verification')}
                className="flex items-center gap-3 p-4 rounded-lg bg-background hover:bg-muted transition-colors text-left group"
              >
                <div className="p-2 rounded-full bg-amber-500/10">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Pending Verification</p>
                  <p className="text-2xl font-bold">{pa.pendingVerification}</p>
                </div>
              </button>
              <button
                onClick={() => navigate('/procurement?status=pending_authorization')}
                className="flex items-center gap-3 p-4 rounded-lg bg-background hover:bg-muted transition-colors text-left group"
              >
                <div className="p-2 rounded-full bg-blue-500/10">
                  <Shield className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Pending Authorization</p>
                  <p className="text-2xl font-bold">{pa.pendingAuthorization}</p>
                </div>
              </button>
              <button
                onClick={() => navigate('/procurement?status=pending_approval')}
                className="flex items-center gap-3 p-4 rounded-lg bg-background hover:bg-muted transition-colors text-left group"
              >
                <div className="p-2 rounded-full bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Pending Approval</p>
                  <p className="text-2xl font-bold">{pa.pendingApproval}</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions & System Status */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t('dashboard.quick_actions', 'Quick Actions')}</CardTitle>
            <CardDescription>{t('dashboard.quick_actions_desc', 'Common tasks you can perform')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {/* Sales Quick Actions */}
            {showSalesDashboard && (
              <>
                <QuickActionButton 
                  icon={TrendingUp} 
                  label="Add New Lead" 
                  description="Create a new lead entry"
                  onClick={() => setShowCreateLead(true)}
                />
                <QuickActionButton 
                  icon={UserPlus} 
                  label="Add Customer" 
                  description="Register a new customer"
                  onClick={() => navigate('/customers')}
                />
                <QuickActionButton 
                  icon={FileText} 
                  label="Create Quotation" 
                  description="Prepare a new quotation"
                  onClick={() => navigate('/leads')}
                />
              </>
            )}
            
            {/* Procurement Quick Actions */}
            {showProcurementDashboard && (
              <>
                <QuickActionButton 
                  icon={ClipboardList} 
                  label="Create Purchase Order" 
                  description="Start a new PO"
                  onClick={() => navigate('/procurement')}
                />
                <QuickActionButton 
                  icon={Truck} 
                  label="Manage Suppliers" 
                  description="View or add suppliers"
                  onClick={() => navigate('/procurement?tab=suppliers')}
                />
                <QuickActionButton 
                  icon={PackagePlus} 
                  label="Adjust Stock" 
                  description="Update inventory levels"
                  onClick={() => navigate('/inventory')}
                />
              </>
            )}
            {/* Accounts Quick Actions */}
            {showAccountsDashboard && (
              <>
                <QuickActionButton 
                  icon={CreditCard} 
                  label="Record Payment" 
                  description="Record a customer payment"
                  onClick={() => navigate('/accounts')}
                />
                <QuickActionButton 
                  icon={ClipboardList} 
                  label="View Orders" 
                  description="Browse all sales orders"
                  onClick={() => navigate('/accounts')}
                />
                <QuickActionButton 
                  icon={Users} 
                  label="View Customers" 
                  description="Browse customer accounts"
                  onClick={() => navigate('/accounts')}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t('dashboard.system_status', 'System Status')}</CardTitle>
            <CardDescription>{t('dashboard.system_info', 'Current system information')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Your Role</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {roles.length > 0 ? roles.map(r => r.replace('_', ' ')).join(', ') : 'No role assigned'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Office</p>
                <p className="text-sm text-muted-foreground">
                  {profile?.office_id ? 'Assigned' : 'Not assigned to any office'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
              <div>
                <p className="font-medium text-success">System Online</p>
                <p className="text-sm text-muted-foreground">All services operational</p>
              </div>
              <div className="h-3 w-3 rounded-full bg-success animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>

      <CreateLeadDialog open={showCreateLead} onOpenChange={setShowCreateLead} />

      <LeadsDrilldownDialog open={activeDrilldown === 'Total Leads'} onOpenChange={(open) => !open && setActiveDrilldown(null)} dateRange={dateRange} assignedTo={scopedAssignedTo} />
      <RevenueDrilldownDialog open={activeDrilldown === 'Total Revenue'} onOpenChange={(open) => !open && setActiveDrilldown(null)} dateRange={dateRange} assignedTo={scopedAssignedTo} />
      <CustomersDrilldownDialog open={activeDrilldown === 'Total Customers'} onOpenChange={(open) => !open && setActiveDrilldown(null)} dateRange={dateRange} assignedTo={scopedAssignedTo} />
      <QuotationsDrilldownDialog open={activeDrilldown === 'Pending Quotations'} onOpenChange={(open) => !open && setActiveDrilldown(null)} dateRange={dateRange} assignedTo={scopedAssignedTo} />
      <DealsWonDrilldownDialog open={activeDrilldown === 'Deals Won'} onOpenChange={(open) => !open && setActiveDrilldown(null)} dateRange={dateRange} assignedTo={scopedAssignedTo} />
      <DraftPOsDrilldownDialog open={activeDrilldown === 'Draft POs'} onOpenChange={(open) => !open && setActiveDrilldown(null)} dateRange={dateRange} />
      <PendingPOsDrilldownDialog open={activeDrilldown === 'Pending POs'} onOpenChange={(open) => !open && setActiveDrilldown(null)} dateRange={dateRange} />
      <LowStockDrilldownDialog open={activeDrilldown === 'Low Stock Alerts'} onOpenChange={(open) => !open && setActiveDrilldown(null)} dateRange={dateRange} />
      <SuppliersDrilldownDialog open={activeDrilldown === 'Active Suppliers'} onOpenChange={(open) => !open && setActiveDrilldown(null)} dateRange={dateRange} />
      <InventoryDrilldownDialog open={activeDrilldown === 'Inventory Items'} onOpenChange={(open) => !open && setActiveDrilldown(null)} dateRange={dateRange} />
      <ReceivablesDrilldownDialog open={activeDrilldown === 'Total Receivables'} onOpenChange={(open) => !open && setActiveDrilldown(null)} />
      <OverduePaymentsDrilldownDialog open={activeDrilldown === 'Overdue Payments'} onOpenChange={(open) => !open && setActiveDrilldown(null)} />
    </div>
  );
}

function QuickActionButton({ 
  icon: Icon, 
  label, 
  description,
  onClick
}: { 
  icon: React.ElementType; 
  label: string; 
  description: string;
  onClick?: () => void;
}) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left w-full group"
    >
      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

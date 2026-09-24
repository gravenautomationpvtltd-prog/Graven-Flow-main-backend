import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, TrendingUp, Users, Package, Receipt, BarChart3, GitCompare, Repeat } from 'lucide-react';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { useLeadsReportData, useOrdersReportData, useInvoicesReportData, useCustomersReportData, useInventoryReportData } from '@/hooks/useReports';
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activity-logger';
import { toast } from 'sonner';
import { DataQualityWidget } from '@/components/reports/DataQualityWidget';
import { ConversionFunnelChart } from '@/components/reports/ConversionFunnelChart';
import { CustomerHealthTable } from '@/components/reports/CustomerHealthTable';
import { SalesPipelineChart } from '@/components/reports/SalesPipelineChart';
import { HighQuoteLowOrderTable } from '@/components/reports/HighQuoteLowOrderTable';
import { MonthlyComparisonView } from '@/components/reports/MonthlyComparisonView';
import { LeaderboardsTab } from '@/components/reports/LeaderboardsTab';
import { QuotationAnalyticsTab } from '@/components/reports/QuotationAnalyticsTab';
import { SegmentForecastTab } from '@/components/reports/SegmentForecastTab';
import { OrderFrequencyTab } from '@/components/reports/OrderFrequencyTab';
import { QuotationCoverageTab } from '@/components/reports/QuotationCoverageTab';

import { SalesExecutiveSummary } from '@/components/reports/SalesExecutiveSummary';
import { NegotiationFunnelChart } from '@/components/reports/NegotiationFunnelChart';
import { SmartRecommendations } from '@/components/reports/SmartRecommendations';
import { Trophy, PieChart } from 'lucide-react';

export default function Reports() {
  const { t } = useTranslation();
  const { isProcurementManager, isAdmin, isSalesManager } = useAuth();
  const procurementManagerOnly = isProcurementManager && !isAdmin && !isSalesManager;

  const [datePreset, setDatePreset] = useState<'all_time' | 'this_month' | 'last_month' | 'last_30_days' | 'last_90_days' | 'this_year' | 'last_year' | 'custom'>('last_30_days');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  
  const dateRange = datePreset === 'custom' 
    ? { from: customFrom, to: customTo }
    : datePreset === 'all_time'
    ? { from: undefined, to: undefined }
    : (() => {
        const today = new Date();
        switch (datePreset) {
          case 'this_month': return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: new Date(today.getFullYear(), today.getMonth() + 1, 0) };
          case 'last_month': return { from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: new Date(today.getFullYear(), today.getMonth(), 0) };
          case 'last_30_days': return { from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), to: today };
          case 'last_90_days': return { from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), to: today };
          case 'this_year': return { from: new Date(today.getFullYear(), 0, 1), to: new Date(today.getFullYear(), 11, 31) };
          case 'last_year': return { from: new Date(today.getFullYear() - 1, 0, 1), to: new Date(today.getFullYear() - 1, 11, 31) };
          default: return { from: undefined, to: undefined };
        }
      })();

  const { data: leadsData } = useLeadsReportData(dateRange.from, dateRange.to);
  const { data: ordersData } = useOrdersReportData(dateRange.from, dateRange.to);
  const { data: invoicesData } = useInvoicesReportData(dateRange.from, dateRange.to);
  const { data: customersData } = useCustomersReportData();
  const { data: inventoryData } = useInventoryReportData();

  const handleExportCSV = async (type: string, data: any[]) => {
    if (!data?.length) { toast.error('No data to export'); return; }
    const headers = Object.keys(data[0]).filter(k => !k.includes('_id') && k !== 'id');
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = row[h];
        if (typeof val === 'object') return JSON.stringify(val);
        return `"${String(val || '').replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    await logActivity({ action: 'export', entityType: 'report', entityName: `${type} Report`, metadata: { format: 'csv', count: data.length } });
    toast.success(`Exported ${data.length} ${type}`);
  };

  const reportCards = [
    { id: 'leads', title: 'Leads', icon: TrendingUp, count: leadsData?.length || 0, data: leadsData },
    { id: 'orders', title: 'Orders', icon: FileText, count: ordersData?.length || 0, data: ordersData },
    { id: 'invoices', title: 'Invoices', icon: Receipt, count: invoicesData?.length || 0, data: invoicesData },
    { id: 'customers', title: 'Customers', icon: Users, count: customersData?.length || 0, data: customersData },
    { id: 'inventory', title: 'Inventory', icon: Package, count: inventoryData?.length || 0, data: inventoryData },
  ];

  if (procurementManagerOnly) {
    return <Navigate to="/reports/procurement-team" replace />;
  }

  return (
    <div className="space-y-6">
      <Helmet><title>Reports Hub | Graven</title></Helmet>
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            {t('reports.title', 'Reports Hub')}
          </h1>
          <p className="text-muted-foreground">{t('reports.subtitle', 'Actionable insights and data exports')}</p>
        </div>
        <DateRangeFilter
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

      <Tabs defaultValue="insights" className="space-y-6">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-1.5">
            <GitCompare className="h-3.5 w-3.5" />
            Month vs Month
          </TabsTrigger>
          <TabsTrigger value="leaderboards" className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            Leaderboards
          </TabsTrigger>
          <TabsTrigger value="quotations" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Quotation Analytics
          </TabsTrigger>
          <TabsTrigger value="segments" className="flex items-center gap-1.5">
            <PieChart className="h-3.5 w-3.5" />
            Segment Forecast
          </TabsTrigger>
          <TabsTrigger value="order-frequency" className="flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5" />
            Order Frequency
          </TabsTrigger>
          <TabsTrigger value="coverage" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Quotation Coverage
          </TabsTrigger>
          <TabsTrigger value="exports">Data Exports</TabsTrigger>
        </TabsList>

        <TabsContent value="coverage" className="space-y-6">
          <QuotationCoverageTab dateFrom={dateRange.from} dateTo={dateRange.to} />
        </TabsContent>




        <TabsContent value="insights" className="space-y-6">
          <SalesExecutiveSummary dateFrom={dateRange.from} dateTo={dateRange.to} />

          <div className="grid gap-6 lg:grid-cols-4">
            <div className="lg:col-span-3">
              <ConversionFunnelChart dateFrom={dateRange.from} dateTo={dateRange.to} />
            </div>
            <DataQualityWidget />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <NegotiationFunnelChart dateFrom={dateRange.from} dateTo={dateRange.to} />
            <SalesPipelineChart dateFrom={dateRange.from} dateTo={dateRange.to} />
          </div>

          <HighQuoteLowOrderTable dateFrom={dateRange.from} dateTo={dateRange.to} />

          <SmartRecommendations dateFrom={dateRange.from} dateTo={dateRange.to} />

          <CustomerHealthTable dateFrom={dateRange.from} dateTo={dateRange.to} />
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <MonthlyComparisonView />
        </TabsContent>

        <TabsContent value="leaderboards" className="space-y-6">
          <LeaderboardsTab dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="quotations" className="space-y-6">
          <QuotationAnalyticsTab dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="segments" className="space-y-6">
          <SegmentForecastTab dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="order-frequency" className="space-y-6">
          <OrderFrequencyTab />
        </TabsContent>



        <TabsContent value="exports" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-5">
            {reportCards.map((report) => (
              <Card key={report.id} className="cursor-pointer hover:border-primary transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <report.icon className="h-4 w-4" />
                    {report.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{report.count}</div>
                    <p className="text-xs text-muted-foreground">records</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => report.data && handleExportCSV(report.id, report.data)} disabled={!report.data?.length}>
                    <Download className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Date range filters apply to Leads, Orders, and Invoices exports
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

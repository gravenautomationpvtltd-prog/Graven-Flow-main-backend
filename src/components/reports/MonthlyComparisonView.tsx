import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, FileText, Users, Receipt, Target, DollarSign } from 'lucide-react';
import { useConversionFunnel } from '@/hooks/useActionableReports';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';

interface MetricComparisonProps {
  label: string;
  thisMonth: number;
  lastMonth: number;
  format?: 'number' | 'currency' | 'percent';
  icon: React.ReactNode;
  invertColors?: boolean;
}

function MetricComparison({ label, thisMonth, lastMonth, format = 'number', icon, invertColors = false }: MetricComparisonProps) {
  const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : thisMonth > 0 ? 100 : 0;
  const isPositive = change > 0;
  const isNeutral = change === 0;
  
  const formatValue = (val: number) => {
    if (format === 'currency') return formatCurrencyWithSymbol(val);
    if (format === 'percent') return `${val.toFixed(1)}%`;
    return val.toLocaleString();
  };

  const getChangeColor = () => {
    if (isNeutral) return 'text-muted-foreground';
    if (invertColors) return isPositive ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
    return isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl font-bold">{formatValue(thisMonth)}</span>
            <span className="text-sm text-muted-foreground">vs {formatValue(lastMonth)}</span>
          </div>
        </div>
      </div>
      <div className={`flex items-center gap-1 ${getChangeColor()}`}>
        {isNeutral ? (
          <Minus className="h-4 w-4" />
        ) : isPositive ? (
          <ArrowUpRight className="h-4 w-4" />
        ) : (
          <ArrowDownRight className="h-4 w-4" />
        )}
        <span className="text-sm font-semibold">{Math.abs(change).toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function MonthlyComparisonView() {
  const now = new Date();
  
  // This month range
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  // Last month range
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Conversion funnel data
  const { data: thisMonthFunnel, isLoading: loadingThisMonth } = useConversionFunnel(thisMonthStart, thisMonthEnd);
  const { data: lastMonthFunnel, isLoading: loadingLastMonth } = useConversionFunnel(lastMonthStart, lastMonthEnd);

  // Orders data
  const { data: ordersComparison, isLoading: loadingOrders } = useQuery({
    queryKey: ['reports', 'orders-comparison'],
    queryFn: async () => {
      const [thisMonthOrders, lastMonthOrders] = await Promise.all([
        supabase
          .from('sales_orders')
          .select('id, order_value, status')
          .gte('created_at', thisMonthStart.toISOString())
          .lte('created_at', thisMonthEnd.toISOString()),
        supabase
          .from('sales_orders')
          .select('id, order_value, status')
          .gte('created_at', lastMonthStart.toISOString())
          .lte('created_at', lastMonthEnd.toISOString())
      ]);

      return {
        thisMonth: {
          count: thisMonthOrders.data?.length || 0,
          value: thisMonthOrders.data?.reduce((sum, o) => sum + (o.order_value || 0), 0) || 0,
          fulfilled: thisMonthOrders.data?.filter(o => o.status === 'fulfilled').length || 0
        },
        lastMonth: {
          count: lastMonthOrders.data?.length || 0,
          value: lastMonthOrders.data?.reduce((sum, o) => sum + (o.order_value || 0), 0) || 0,
          fulfilled: lastMonthOrders.data?.filter(o => o.status === 'fulfilled').length || 0
        }
      };
    }
  });

  // Invoices data
  const { data: invoicesComparison, isLoading: loadingInvoices } = useQuery({
    queryKey: ['reports', 'invoices-comparison'],
    queryFn: async () => {
      const [thisMonthInvoices, lastMonthInvoices] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, grand_total, amount_paid, status')
          .gte('created_at', thisMonthStart.toISOString())
          .lte('created_at', thisMonthEnd.toISOString()),
        supabase
          .from('invoices')
          .select('id, grand_total, amount_paid, status')
          .gte('created_at', lastMonthStart.toISOString())
          .lte('created_at', lastMonthEnd.toISOString())
      ]);

      return {
        thisMonth: {
          count: thisMonthInvoices.data?.length || 0,
          value: thisMonthInvoices.data?.reduce((sum, i) => sum + (i.grand_total || 0), 0) || 0,
          collected: thisMonthInvoices.data?.reduce((sum, i) => sum + (i.amount_paid || 0), 0) || 0
        },
        lastMonth: {
          count: lastMonthInvoices.data?.length || 0,
          value: lastMonthInvoices.data?.reduce((sum, i) => sum + (i.grand_total || 0), 0) || 0,
          collected: lastMonthInvoices.data?.reduce((sum, i) => sum + (i.amount_paid || 0), 0) || 0
        }
      };
    }
  });

  // Customers data
  const { data: customersComparison, isLoading: loadingCustomers } = useQuery({
    queryKey: ['reports', 'customers-comparison'],
    queryFn: async () => {
      const [thisMonthCustomers, lastMonthCustomers] = await Promise.all([
        supabase
          .from('customers')
          .select('id', { count: 'exact' })
          .gte('created_at', thisMonthStart.toISOString())
          .lte('created_at', thisMonthEnd.toISOString()),
        supabase
          .from('customers')
          .select('id', { count: 'exact' })
          .gte('created_at', lastMonthStart.toISOString())
          .lte('created_at', lastMonthEnd.toISOString())
      ]);

      return {
        thisMonth: thisMonthCustomers.count || 0,
        lastMonth: lastMonthCustomers.count || 0
      };
    }
  });

  const isLoading = loadingThisMonth || loadingLastMonth || loadingOrders || loadingInvoices || loadingCustomers;

  // Extract funnel metrics
  const thisMonthLeads = thisMonthFunnel?.find(f => f.stage === 'Total Leads')?.count || 0;
  const lastMonthLeads = lastMonthFunnel?.find(f => f.stage === 'Total Leads')?.count || 0;
  
  const thisMonthQuoted = thisMonthFunnel?.find(f => f.stage === 'Quoted')?.count || 0;
  const lastMonthQuoted = lastMonthFunnel?.find(f => f.stage === 'Quoted')?.count || 0;
  
  const thisMonthWon = thisMonthFunnel?.find(f => f.stage === 'Won')?.count || 0;
  const lastMonthWon = lastMonthFunnel?.find(f => f.stage === 'Won')?.count || 0;

  const thisMonthConversion = thisMonthLeads > 0 ? (thisMonthWon / thisMonthLeads) * 100 : 0;
  const lastMonthConversion = lastMonthLeads > 0 ? (lastMonthWon / lastMonthLeads) * 100 : 0;

  const thisMonthName = now.toLocaleDateString('en-US', { month: 'long' });
  const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long' });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {thisMonthName} vs {lastMonthName} Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Lead Metrics */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Lead Generation</h3>
              <MetricComparison
                label="New Leads"
                thisMonth={thisMonthLeads}
                lastMonth={lastMonthLeads}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <MetricComparison
                label="Leads Quoted"
                thisMonth={thisMonthQuoted}
                lastMonth={lastMonthQuoted}
                icon={<FileText className="h-4 w-4" />}
              />
              <MetricComparison
                label="Deals Won"
                thisMonth={thisMonthWon}
                lastMonth={lastMonthWon}
                icon={<Target className="h-4 w-4" />}
              />
              <MetricComparison
                label="Win Rate"
                thisMonth={thisMonthConversion}
                lastMonth={lastMonthConversion}
                format="percent"
                icon={<Target className="h-4 w-4" />}
              />
            </div>

            {/* Order & Revenue Metrics */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Orders & Revenue</h3>
              <MetricComparison
                label="Orders Created"
                thisMonth={ordersComparison?.thisMonth.count || 0}
                lastMonth={ordersComparison?.lastMonth.count || 0}
                icon={<FileText className="h-4 w-4" />}
              />
              <MetricComparison
                label="Order Value"
                thisMonth={ordersComparison?.thisMonth.value || 0}
                lastMonth={ordersComparison?.lastMonth.value || 0}
                format="currency"
                icon={<DollarSign className="h-4 w-4" />}
              />
              <MetricComparison
                label="Orders Fulfilled"
                thisMonth={ordersComparison?.thisMonth.fulfilled || 0}
                lastMonth={ordersComparison?.lastMonth.fulfilled || 0}
                icon={<Target className="h-4 w-4" />}
              />
              <MetricComparison
                label="New Customers"
                thisMonth={customersComparison?.thisMonth || 0}
                lastMonth={customersComparison?.lastMonth || 0}
                icon={<Users className="h-4 w-4" />}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Invoicing & Collections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <MetricComparison
              label="Invoices Created"
              thisMonth={invoicesComparison?.thisMonth.count || 0}
              lastMonth={invoicesComparison?.lastMonth.count || 0}
              icon={<Receipt className="h-4 w-4" />}
            />
            <MetricComparison
              label="Invoice Value"
              thisMonth={invoicesComparison?.thisMonth.value || 0}
              lastMonth={invoicesComparison?.lastMonth.value || 0}
              format="currency"
              icon={<DollarSign className="h-4 w-4" />}
            />
            <MetricComparison
              label="Amount Collected"
              thisMonth={invoicesComparison?.thisMonth.collected || 0}
              lastMonth={invoicesComparison?.lastMonth.collected || 0}
              format="currency"
              icon={<DollarSign className="h-4 w-4" />}
            />
            <MetricComparison
              label="Collection Rate"
              thisMonth={invoicesComparison?.thisMonth.value ? (invoicesComparison.thisMonth.collected / invoicesComparison.thisMonth.value) * 100 : 0}
              lastMonth={invoicesComparison?.lastMonth.value ? (invoicesComparison.lastMonth.collected / invoicesComparison.lastMonth.value) * 100 : 0}
              format="percent"
              icon={<Target className="h-4 w-4" />}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

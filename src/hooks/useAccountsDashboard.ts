import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subMonths, startOfMonth, endOfMonth, format, differenceInDays } from 'date-fns';
import { useVertical } from '@/contexts/VerticalContext';

interface AccountsStats {
  totalReceivables: number;
  paymentsReceived: number;
  pendingInvoices: number;
  overdueOrders: number;
  totalCustomers: number;
}

interface AgingBucket {
  name: string;
  value: number;
}

interface OutstandingCustomer {
  name: string;
  amount: number;
}

interface DateRange {
  from?: Date;
  to?: Date;
}

const ACCOUNTS_STALE_TIME = 5 * 60 * 1000;

function vEq<T>(q: any, vId: string | null): any {
  return vId ? q.eq('vertical_id', vId) : q;
}

// Unified accounts data hook — single fetch for stats, aging, and top customers
export function useAccountsData(dateRange: DateRange, enabled: boolean = true) {
  const { activeVerticalId } = useVertical();
  return useQuery({
    queryKey: ['accounts-unified-data', activeVerticalId, dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    staleTime: ACCOUNTS_STALE_TIME,
    enabled,
    queryFn: async (): Promise<{
      stats: AccountsStats;
      aging: AgingBucket[];
      topCustomers: OutstandingCustomer[];
    }> => {
      let paymentsQuery: any = supabase.from('customer_payments').select('amount, sales_order_id');
      paymentsQuery = vEq(paymentsQuery, activeVerticalId);
      if (dateRange.from) paymentsQuery = paymentsQuery.gte('payment_date', dateRange.from.toISOString());
      if (dateRange.to) paymentsQuery = paymentsQuery.lte('payment_date', dateRange.to.toISOString());

      const [
        { data: orders },
        { data: allPayments },
        { data: filteredPayments },
        { data: invoices },
      ] = await Promise.all([
        vEq(supabase.from('sales_orders').select('id, order_value, created_at, customer_id, customer:customers(company_name)'), activeVerticalId),
        vEq(supabase.from('customer_payments').select('sales_order_id, amount'), activeVerticalId),
        paymentsQuery,
        vEq(supabase.from('invoices').select('id, grand_total, amount_paid').neq('status', 'paid'), activeVerticalId),
      ]);

      const paymentsByOrder: Record<string, number> = {};
      (allPayments || []).forEach((p: any) => {
        if (p.sales_order_id) paymentsByOrder[p.sales_order_id] = (paymentsByOrder[p.sales_order_id] || 0) + p.amount;
      });

      let totalReceivables = 0;
      const now = new Date();
      let overdueOrders = 0;
      const uniqueCustomers = new Set<string>();

      (orders || []).forEach((o: any) => {
        const paid = paymentsByOrder[o.id] || 0;
        const outstanding = (o.order_value || 0) - paid;
        if (outstanding > 0) totalReceivables += outstanding;
        if (o.customer_id) uniqueCustomers.add(o.customer_id);
        if (outstanding > 0) {
          const dueDate = new Date(o.created_at);
          dueDate.setDate(dueDate.getDate() + 30);
          if (now > dueDate) overdueOrders++;
        }
      });

      const paymentsReceived = (filteredPayments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      const pendingInvoices = (invoices || []).filter((inv: any) => (inv.amount_paid || 0) < (inv.grand_total || 0)).length;

      const buckets = [
        { name: '0-30 days', min: 0, max: 30, value: 0 },
        { name: '31-60 days', min: 31, max: 60, value: 0 },
        { name: '61-90 days', min: 61, max: 90, value: 0 },
        { name: '90+ days', min: 91, max: Infinity, value: 0 },
      ];

      (orders || []).forEach((o: any) => {
        const paid = paymentsByOrder[o.id] || 0;
        const outstanding = (o.order_value || 0) - paid;
        if (outstanding <= 0) return;
        const days = differenceInDays(now, new Date(o.created_at));
        const bucket = buckets.find(b => days >= b.min && days <= b.max);
        if (bucket) bucket.value += outstanding;
      });

      const customerOutstanding: Record<string, { name: string; amount: number }> = {};
      (orders || []).forEach((o: any) => {
        const paid = paymentsByOrder[o.id] || 0;
        const outstanding = (o.order_value || 0) - paid;
        if (outstanding <= 0 || !o.customer_id) return;
        if (!customerOutstanding[o.customer_id]) {
          customerOutstanding[o.customer_id] = { name: o.customer?.company_name || 'Unknown', amount: 0 };
        }
        customerOutstanding[o.customer_id].amount += outstanding;
      });

      const topCustomers = Object.values(customerOutstanding).sort((a, b) => b.amount - a.amount).slice(0, 10);

      return {
        stats: { totalReceivables, paymentsReceived, pendingInvoices, overdueOrders, totalCustomers: uniqueCustomers.size },
        aging: buckets.map(b => ({ name: b.name, value: b.value })),
        topCustomers,
      };
    },
  });
}

export function useAccountsStats(dateRange: DateRange, enabled: boolean = true) {
  const { activeVerticalId } = useVertical();
  return useQuery({
    queryKey: ['accounts-stats', activeVerticalId, dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    staleTime: ACCOUNTS_STALE_TIME,
    enabled,
    queryFn: async (): Promise<AccountsStats> => {
      let paymentsQuery: any = supabase.from('customer_payments').select('amount, sales_order_id');
      paymentsQuery = vEq(paymentsQuery, activeVerticalId);
      if (dateRange.from) paymentsQuery = paymentsQuery.gte('payment_date', dateRange.from.toISOString());
      if (dateRange.to) paymentsQuery = paymentsQuery.lte('payment_date', dateRange.to.toISOString());

      const [
        { data: orders },
        { data: allPayments },
        { data: filteredPayments },
        { data: invoices },
        { data: customerOrders },
      ] = await Promise.all([
        vEq(supabase.from('sales_orders').select('id, order_value, created_at'), activeVerticalId),
        vEq(supabase.from('customer_payments').select('sales_order_id, amount'), activeVerticalId),
        paymentsQuery,
        vEq(supabase.from('invoices').select('id, grand_total, amount_paid').neq('status', 'paid'), activeVerticalId),
        vEq(supabase.from('sales_orders').select('customer_id'), activeVerticalId),
      ]);

      const paymentsByOrder: Record<string, number> = {};
      (allPayments || []).forEach((p: any) => {
        if (p.sales_order_id) paymentsByOrder[p.sales_order_id] = (paymentsByOrder[p.sales_order_id] || 0) + p.amount;
      });

      const totalReceivables = (orders || []).reduce((sum: number, o: any) => {
        const paid = paymentsByOrder[o.id] || 0;
        return sum + Math.max(0, (o.order_value || 0) - paid);
      }, 0);

      const paymentsReceived = (filteredPayments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      const pendingInvoices = (invoices || []).filter((inv: any) => (inv.amount_paid || 0) < (inv.grand_total || 0)).length;

      const now = new Date();
      let overdueOrders = 0;
      (orders || []).forEach((o: any) => {
        const paid = paymentsByOrder[o.id] || 0;
        if (paid >= (o.order_value || 0)) return;
        const dueDate = new Date(o.created_at);
        dueDate.setDate(dueDate.getDate() + 30);
        if (now > dueDate) overdueOrders++;
      });

      const uniqueCustomers = new Set((customerOrders || []).map((o: any) => o.customer_id).filter(Boolean));

      return { totalReceivables, paymentsReceived, pendingInvoices, overdueOrders, totalCustomers: uniqueCustomers.size };
    },
  });
}

export function usePaymentCollectionTrend(enabled: boolean = true) {
  const { activeVerticalId } = useVertical();
  return useQuery({
    queryKey: ['payment-collection-trend', activeVerticalId],
    staleTime: ACCOUNTS_STALE_TIME,
    enabled,
    queryFn: async () => {
      const now = new Date();
      const sixMonthsAgo = startOfMonth(subMonths(now, 5));
      const currentMonthEnd = endOfMonth(now);

      let q: any = supabase
        .from('customer_payments')
        .select('amount, payment_date')
        .gte('payment_date', sixMonthsAgo.toISOString())
        .lte('payment_date', currentMonthEnd.toISOString());
      q = vEq(q, activeVerticalId);
      const { data } = await q;

      const monthBuckets: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const key = format(startOfMonth(subMonths(now, i)), 'MMM yy');
        monthBuckets[key] = 0;
      }

      (data || []).forEach((p: any) => {
        const key = format(new Date(p.payment_date), 'MMM yy');
        if (key in monthBuckets) monthBuckets[key] += p.amount;
      });

      return Object.entries(monthBuckets).map(([month, amount]) => ({ month, amount }));
    },
  });
}

export function useReceivablesAging() {
  const { activeVerticalId } = useVertical();
  return useQuery({
    queryKey: ['receivables-aging', activeVerticalId],
    staleTime: ACCOUNTS_STALE_TIME,
    queryFn: async () => {
      const [{ data: orders }, { data: payments }] = await Promise.all([
        vEq(supabase.from('sales_orders').select('id, order_value, created_at'), activeVerticalId),
        vEq(supabase.from('customer_payments').select('sales_order_id, amount'), activeVerticalId),
      ]);

      const paymentsByOrder: Record<string, number> = {};
      (payments || []).forEach((p: any) => {
        if (p.sales_order_id) paymentsByOrder[p.sales_order_id] = (paymentsByOrder[p.sales_order_id] || 0) + p.amount;
      });

      const buckets = [
        { name: '0-30 days', min: 0, max: 30, value: 0 },
        { name: '31-60 days', min: 31, max: 60, value: 0 },
        { name: '61-90 days', min: 61, max: 90, value: 0 },
        { name: '90+ days', min: 91, max: Infinity, value: 0 },
      ];

      const now = new Date();
      (orders || []).forEach((o: any) => {
        const paid = paymentsByOrder[o.id] || 0;
        const outstanding = (o.order_value || 0) - paid;
        if (outstanding <= 0) return;
        const days = differenceInDays(now, new Date(o.created_at));
        const bucket = buckets.find(b => days >= b.min && days <= b.max);
        if (bucket) bucket.value += outstanding;
      });

      return buckets;
    },
  });
}

export function useTopOutstandingCustomers() {
  const { activeVerticalId } = useVertical();
  return useQuery({
    queryKey: ['top-outstanding-customers', activeVerticalId],
    staleTime: ACCOUNTS_STALE_TIME,
    queryFn: async () => {
      const [{ data: orders }, { data: payments }] = await Promise.all([
        vEq(supabase.from('sales_orders').select('id, order_value, customer_id, customer:customers(company_name)'), activeVerticalId),
        vEq(supabase.from('customer_payments').select('sales_order_id, amount'), activeVerticalId),
      ]);

      const paymentsByOrder: Record<string, number> = {};
      (payments || []).forEach((p: any) => {
        if (p.sales_order_id) paymentsByOrder[p.sales_order_id] = (paymentsByOrder[p.sales_order_id] || 0) + p.amount;
      });

      const customerOutstanding: Record<string, { name: string; amount: number }> = {};
      (orders || []).forEach((o: any) => {
        const paid = paymentsByOrder[o.id] || 0;
        const outstanding = (o.order_value || 0) - paid;
        if (outstanding <= 0 || !o.customer_id) return;
        if (!customerOutstanding[o.customer_id]) {
          customerOutstanding[o.customer_id] = { name: o.customer?.company_name || 'Unknown', amount: 0 };
        }
        customerOutstanding[o.customer_id].amount += outstanding;
      });

      return Object.values(customerOutstanding).sort((a, b) => b.amount - a.amount).slice(0, 10);
    },
  });
}

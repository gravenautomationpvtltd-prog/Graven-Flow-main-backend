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

const ACCOUNTS_STALE_TIME = 60 * 1000;

function vEq<T>(q: any, vId: string | null): any {
  return vId ? q.eq('vertical_id', vId) : q;
}

// Unified accounts data hook — single fetch for stats, aging, and top customers
export function useAccountsData(dateRange: DateRange, enabled: boolean = true) {
  const { activeVerticalId } = useVertical();
  return useQuery({
    queryKey: ['accounts-unified-data', activeVerticalId, dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    staleTime: ACCOUNTS_STALE_TIME,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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

      const fetchOrders = async () => {
        try {
          const res = await vEq(supabase.from('sales_orders').select('id, order_value, created_at, customer_id, customer:customers(company_name)'), activeVerticalId);
          if (res.error) {
            return await vEq(supabase.from('sales_orders').select('id, order_value, created_at, customer_id'), activeVerticalId);
          }
          return res;
        } catch {
          return { data: [] };
        }
      };

      const fetchAllPayments = async () => {
        try {
          return await vEq(supabase.from('customer_payments').select('sales_order_id, amount'), activeVerticalId);
        } catch {
          return { data: [] };
        }
      };

      const fetchFilteredPayments = async () => {
        try {
          return await paymentsQuery;
        } catch {
          return { data: [] };
        }
      };

      const fetchInvoices = async () => {
        try {
          return await vEq(supabase.from('invoices').select('id, grand_total, amount_paid').neq('status', 'paid').neq('status', 'cancelled'), activeVerticalId);
        } catch {
          return { data: [] };
        }
      };

      const [
        ordersRes,
        allPaymentsRes,
        filteredPaymentsRes,
        invoicesRes,
      ] = await Promise.all([
        fetchOrders(),
        fetchAllPayments(),
        fetchFilteredPayments(),
        fetchInvoices(),
      ]);

      const orders = ordersRes?.data || [];
      const allPayments = allPaymentsRes?.data || [];
      const filteredPayments = filteredPaymentsRes?.data || [];
      const invoices = invoicesRes?.data || [];

      const paymentsByOrder: Record<string, number> = {};
      (allPayments || []).forEach((p: any) => {
        if (p.sales_order_id) {
          paymentsByOrder[p.sales_order_id] = (paymentsByOrder[p.sales_order_id] || 0) + Number(p.amount || 0);
        }
      });

      let totalReceivables = 0;
      const now = new Date();
      let overdueOrders = 0;
      const uniqueCustomers = new Set<string>();
      
      (orders || []).forEach((o: any) => {
        const orderVal = Number(o.order_value || 0);
        const paid = paymentsByOrder[o.id] || 0;
        const outstanding = orderVal - paid;
        if (outstanding > 0) totalReceivables += outstanding;
        if (o.customer_id) uniqueCustomers.add(o.customer_id);
        if (outstanding > 0) {
          const dueDate = new Date(o.created_at);
          dueDate.setDate(dueDate.getDate() + 30);
          if (now > dueDate) overdueOrders++;
        }
      });

      const paymentsReceived = (filteredPayments || allPayments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const pendingInvoices = (invoices || []).filter((inv: any) => Number(inv.amount_paid || 0) < Number(inv.grand_total || 0)).length;

      const buckets = [
        { name: '0-30 days', min: 0, max: 30, value: 0 },
        { name: '31-60 days', min: 31, max: 60, value: 0 },
        { name: '61-90 days', min: 61, max: 90, value: 0 },
        { name: '90+ days', min: 91, max: Infinity, value: 0 },
      ];

      (orders || []).forEach((o: any) => {
        const orderVal = Number(o.order_value || 0);
        const paid = paymentsByOrder[o.id] || 0;
        const outstanding = orderVal - paid;
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
  const { data, isLoading, error, refetch } = useAccountsData(dateRange, enabled);
  return {
    data: data?.stats,
    isLoading,
    error,
    refetch,
  };
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

export function useReceivablesAging(enabled: boolean = true) {
  const { data, isLoading, error, refetch } = useAccountsData({}, enabled);
  return {
    data: data?.aging,
    isLoading,
    error,
    refetch,
  };
}

export function useTopOutstandingCustomers(enabled: boolean = true) {
  const { data, isLoading, error, refetch } = useAccountsData({}, enabled);
  return {
    data: data?.topCustomers,
    isLoading,
    error,
    refetch,
  };
}

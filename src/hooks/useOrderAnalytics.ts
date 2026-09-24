import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { startOfMonth, subMonths, format } from 'date-fns';

export interface DateRange {
  from: Date | null | undefined;
  to: Date | null | undefined;
}

export interface OrderStats {
  totalOrders: number;
  totalValue: number;
  pendingPayments: number;
  pendingPaymentValue: number;
  fulfilledOrders: number;
  inProgressOrders: number;
  cancelledOrders: number;
  postponedOrders: number;
  avgOrderValue: number;
  collectionRate: number;
}

export interface OrderTrend {
  month: string;
  orders: number;
  value: number;
}

export interface PaymentDistribution {
  status: string;
  count: number;
  value: number;
}

export interface FulfillmentMetrics {
  status: string;
  count: number;
}

export function useOrderStats(userId?: string, dateRange?: DateRange) {
  const { user, isManager, isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['order-stats', userId, isManager, isAdmin, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      let query = supabase.from('sales_orders').select(`
        *,
        quotation:quotations!sales_orders_quotation_id_fkey(subtotal, total_discount)
      `);

      // Role-based filtering
      if (!isManager && !isAdmin && user) {
        query = query.eq('created_by', user.id);
      } else if (userId) {
        query = query.eq('created_by', userId);
      }

      // Date range filtering
      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const orders = (data || []) as any[];
      const netOf = (o: any) => {
        const sub = o?.quotation?.subtotal;
        if (sub != null) return Math.max(0, Number(sub) - Number(o.quotation?.total_discount || 0));
        return Number(o.order_value || 0);
      };

      const totalOrders = orders.length;
      const totalValue = orders.reduce((sum, o) => sum + netOf(o), 0);
      const totalCollected = orders.reduce((sum, o) => sum + (o.payment_amount || 0), 0);

      const pendingPaymentOrders = orders.filter(o => o.payment_status !== 'received');
      const pendingPayments = pendingPaymentOrders.length;
      // Outstanding is a receivables figure — keep it against gross order_value
      const pendingPaymentValue = pendingPaymentOrders.reduce((sum, o) => sum + ((o.order_value || 0) - (o.payment_amount || 0)), 0);

      const fulfilledOrders = orders.filter(o => o.status === 'fulfilled').length;
      const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
      const postponedOrders = orders.filter(o => o.status === 'postponed').length;
      const inProgressOrders = orders.filter(o => !['fulfilled', 'pending_documents', 'cancelled', 'postponed'].includes(o.status)).length;

      const stats: OrderStats = {
        totalOrders,
        totalValue,
        pendingPayments,
        pendingPaymentValue,
        fulfilledOrders,
        inProgressOrders,
        cancelledOrders,
        postponedOrders,
        avgOrderValue: totalOrders > 0 ? totalValue / totalOrders : 0,
        // Collection rate uses gross for AR truthfulness
        collectionRate: (() => {
          const gross = orders.reduce((s, o) => s + (o.order_value || 0), 0);
          return gross > 0 ? (totalCollected / gross) * 100 : 0;
        })(),
      };

      return stats;
    },
  });
}

export function useOrderTrends(userId?: string, dateRange?: DateRange) {
  const { user, isManager, isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['order-trends', userId, isManager, isAdmin, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      // Use dateRange if provided, otherwise default to 6 months
      const startDate = dateRange?.from || subMonths(new Date(), 6);
      const endDate = dateRange?.to || new Date();
      
      let query = supabase
        .from('sales_orders')
        .select('created_at, order_value, quotation:quotations!sales_orders_quotation_id_fkey(subtotal, total_discount)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (!isManager && !isAdmin && user) {
        query = query.eq('created_by', user.id);
      } else if (userId) {
        query = query.eq('created_by', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const netOf = (o: any) => {
        const sub = o?.quotation?.subtotal;
        if (sub != null) return Math.max(0, Number(sub) - Number(o.quotation?.total_discount || 0));
        return Number(o.order_value || 0);
      };

      // Group by month - dynamically based on date range
      const monthlyData: Record<string, { orders: number; value: number }> = {};

      const monthsDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      const monthsToShow = Math.min(Math.max(monthsDiff, 1), 12);

      for (let i = monthsToShow - 1; i >= 0; i--) {
        const monthDate = subMonths(endDate, i);
        const monthKey = format(monthDate, 'MMM yyyy');
        monthlyData[monthKey] = { orders: 0, value: 0 };
      }

      (data || []).forEach((order: any) => {
        const monthKey = format(new Date(order.created_at), 'MMM yyyy');
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].orders += 1;
          monthlyData[monthKey].value += netOf(order);
        }
      });
      
      const trends: OrderTrend[] = Object.entries(monthlyData).map(([month, data]) => ({
        month,
        orders: data.orders,
        value: data.value,
      }));
      
      return trends;
    },
  });
}

export function usePaymentDistribution(userId?: string, dateRange?: DateRange) {
  const { user, isManager, isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['payment-distribution', userId, isManager, isAdmin, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      let query = supabase.from('sales_orders').select('payment_status, order_value, payment_amount');
      
      if (!isManager && !isAdmin && user) {
        query = query.eq('created_by', user.id);
      } else if (userId) {
        query = query.eq('created_by', userId);
      }
      
      // Date range filtering
      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const distribution: Record<string, { count: number; value: number }> = {
        received: { count: 0, value: 0 },
        partial: { count: 0, value: 0 },
        pending: { count: 0, value: 0 },
      };
      
      (data || []).forEach(order => {
        const status = order.payment_status || 'pending';
        if (distribution[status]) {
          distribution[status].count += 1;
          distribution[status].value += order.order_value || 0;
        }
      });
      
      return Object.entries(distribution).map(([status, data]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count: data.count,
        value: data.value,
      }));
    },
  });
}

export function useFulfillmentMetrics(userId?: string, dateRange?: DateRange) {
  const { user, isManager, isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['fulfillment-metrics', userId, isManager, isAdmin, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      let query = supabase.from('sales_orders').select('status');
      
      if (!isManager && !isAdmin && user) {
        query = query.eq('created_by', user.id);
      } else if (userId) {
        query = query.eq('created_by', userId);
      }
      
      // Date range filtering
      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const statusLabels: Record<string, string> = {
        pending_documents: 'Pending Documents',
        ready_for_procurement: 'Ready for Procurement',
        in_procurement: 'In Procurement',
        partially_fulfilled: 'Partially Fulfilled',
        ready_to_dispatch: 'Ready to Dispatch',
        fulfilled: 'Fulfilled',
        cancelled: 'Cancelled',
        postponed: 'Postponed',
      };
      
      const metrics: Record<string, number> = {};
      
      (data || []).forEach(order => {
        const status = order.status || 'pending_documents';
        const label = statusLabels[status] || status;
        metrics[label] = (metrics[label] || 0) + 1;
      });
      
      return Object.entries(metrics).map(([status, count]) => ({
        status,
        count,
      }));
    },
  });
}

export function useTopSalesReps(dateRange?: DateRange) {
  const { isManager, isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['top-sales-reps', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('sales_orders')
        .select(`
          created_by,
          order_value,
          quotation:quotations!sales_orders_quotation_id_fkey(subtotal, total_discount),
          creator:profiles!sales_orders_created_by_fkey(id, full_name)
        `);

      // Date range filtering
      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const repData: Record<string, { name: string; orders: number; value: number }> = {};
      const netOf = (o: any) => {
        const sub = o?.quotation?.subtotal;
        if (sub != null) return Math.max(0, Number(sub) - Number(o.quotation?.total_discount || 0));
        return Number(o.order_value || 0);
      };

      (data || []).forEach((order: any) => {
        const repId = order.created_by;
        const repName = order.creator?.full_name || 'Unknown';
        if (repId) {
          if (!repData[repId]) {
            repData[repId] = { name: repName, orders: 0, value: 0 };
          }
          repData[repId].orders += 1;
          repData[repId].value += netOf(order);
        }
      });
      
      return Object.entries(repData)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    },
    enabled: isManager || isAdmin,
  });
}

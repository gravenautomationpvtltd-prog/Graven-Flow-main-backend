import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerStats {
  totalOrders: number;
  totalRevenue: number;
  totalPayments: number;
  outstandingBalance: number;
  averageOrderValue: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  lifetimeValue: number;
  orderFrequencyDays: number | null;
  totalQuotations: number;
  priceMatchedCount: number;
  convertedCount: number;
  matchToConversionRate: number;
}

export function useCustomerStats(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-stats', customerId],
    queryFn: async (): Promise<CustomerStats> => {
      if (!customerId) {
        return {
          totalOrders: 0, totalRevenue: 0, totalPayments: 0, outstandingBalance: 0,
          averageOrderValue: 0, firstOrderDate: null, lastOrderDate: null,
          lifetimeValue: 0, orderFrequencyDays: null,
          totalQuotations: 0, priceMatchedCount: 0, convertedCount: 0, matchToConversionRate: 0,
        };
      }

      // Fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from('sales_orders')
        .select('id, order_value, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true });

      if (ordersError) throw ordersError;

      // Fetch payments
      const [paymentsRes, quotationsRes] = await Promise.all([
        supabase.from('customer_payments').select('amount').eq('customer_id', customerId),
        supabase.from('quotations').select('id, is_price_matched, is_converted').eq('customer_id', customerId).is('deleted_at', null).neq('status', 'draft'),
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      if (quotationsRes.error) throw quotationsRes.error;
      const payments = paymentsRes.data || [];
      const quotationsData = quotationsRes.data || [];

      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, o) => sum + (o.order_value || 0), 0) || 0;
      const totalPayments = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const outstandingBalance = totalRevenue - totalPayments;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const firstOrderDate = orders?.[0]?.created_at || null;
      const lastOrderDate = orders?.[orders.length - 1]?.created_at || null;

      // Calculate order frequency
      let orderFrequencyDays: number | null = null;
      if (totalOrders >= 2 && firstOrderDate && lastOrderDate) {
        const daysDiff = Math.ceil(
          (new Date(lastOrderDate).getTime() - new Date(firstOrderDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        orderFrequencyDays = Math.round(daysDiff / (totalOrders - 1));
      }

      // Quotation price match stats
      const totalQuotations = quotationsData.length;
      const priceMatchedCount = quotationsData.filter(q => q.is_price_matched).length;
      const convertedCount = quotationsData.filter(q => q.is_converted).length;
      const matchedConverted = quotationsData.filter(q => q.is_price_matched && q.is_converted).length;
      const matchToConversionRate = priceMatchedCount > 0 ? (matchedConverted / priceMatchedCount) * 100 : 0;

      return {
        totalOrders, totalRevenue, totalPayments, outstandingBalance, averageOrderValue,
        firstOrderDate, lastOrderDate, lifetimeValue: totalRevenue, orderFrequencyDays,
        totalQuotations, priceMatchedCount, convertedCount, matchToConversionRate,
      };
    },
    enabled: !!customerId,
  });
}

export function useCustomerOrders(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: async () => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          lead:leads(title),
          quotation:quotations!sales_orders_quotation_id_fkey(quotation_number, grand_total),
          creator:profiles!sales_orders_created_by_fkey(full_name)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });
}

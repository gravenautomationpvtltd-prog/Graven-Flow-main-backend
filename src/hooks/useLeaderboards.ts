import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DateRange {
  from?: Date;
  to?: Date;
}

interface ProductQuoteData {
  product_id: string;
  product_name: string;
  category: string | null;
  quote_count: number;
  quote_value: number;
  customer_count: number;
}

interface ProductOrderData {
  product_id: string;
  product_name: string;
  category: string | null;
  order_count: number;
  units_sold: number;
  revenue: number;
}

interface ProductConversionData {
  product_id: string;
  product_name: string;
  category: string | null;
  quote_count: number;
  order_count: number;
  conversion_rate: number;
}

interface ProductProfitData {
  product_id: string;
  product_name: string;
  category: string | null;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number;
}

interface CustomerRevenueData {
  customer_id: string;
  company_name: string;
  industry: string | null;
  order_count: number;
  revenue: number;
  avg_order_value: number;
}

interface CustomerConversionData {
  customer_id: string;
  company_name: string;
  quote_count: number;
  order_count: number;
  conversion_rate: number;
  revenue: number;
}

export function useProductLeaderboards(dateRange: DateRange, limit: number = 100) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['product-leaderboards', dateRange.from?.toISOString(), dateRange.to?.toISOString(), limit],
    retry: 1,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Get quotation items with product info (for quotes)
      let quotationQuery = supabase
        .from('quotation_items')
        .select(`
          product_id,
          rate,
          quantity,
          amount,
          quotation:quotations!inner(
            id,
            created_at,
            customer_id,
            deleted_at,
            is_converted
          ),
          product:products(
            id,
            name,
            category,
            purchase_price
          )
        `)
        .not('product_id', 'is', null)
        .is('quotation.deleted_at', null);

      if (dateRange.from) {
        quotationQuery = quotationQuery.gte('quotation.created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        quotationQuery = quotationQuery.lte('quotation.created_at', dateRange.to.toISOString());
      }

      // Get sales orders with their quotation info (to map back to items)
      let ordersQuery = supabase
        .from('sales_orders')
        .select(`
          id,
          quotation_id,
          customer_id,
          order_value,
          created_at
        `)
        .not('quotation_id', 'is', null);

      if (dateRange.from) {
        ordersQuery = ordersQuery.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        ordersQuery = ordersQuery.lte('created_at', dateRange.to.toISOString());
      }

      const [quotationResult, ordersResult] = await Promise.all([
        quotationQuery,
        ordersQuery,
      ]);

      if (quotationResult.error) throw quotationResult.error;
      if (ordersResult.error) throw ordersResult.error;

      // Create a set of quotation IDs that became orders
      const convertedQuotationIds = new Set(
        (ordersResult.data || []).map(order => order.quotation_id).filter(Boolean)
      );

      // Aggregate quote data by product
      const quoteMap = new Map<string, {
        product_id: string;
        product_name: string;
        category: string | null;
        quote_count: number;
        quote_value: number;
        customers: Set<string>;
        purchase_price: number | null;
        order_count: number;
        order_value: number;
        units_sold: number;
      }>();

      quotationResult.data?.forEach((item: any) => {
        if (!item.product_id || !item.product) return;
        
        const existing = quoteMap.get(item.product_id) || {
          product_id: item.product_id,
          product_name: item.product.name,
          category: item.product.category,
          quote_count: 0,
          quote_value: 0,
          customers: new Set<string>(),
          purchase_price: item.product.purchase_price,
          order_count: 0,
          order_value: 0,
          units_sold: 0,
        };
        
        existing.quote_count += 1;
        existing.quote_value += item.amount || 0;
        if (item.quotation?.customer_id) {
          existing.customers.add(item.quotation.customer_id);
        }
        
        // If this quotation was converted to an order, count it
        if (convertedQuotationIds.has(item.quotation?.id)) {
          existing.order_count += 1;
          existing.order_value += item.amount || 0;
          existing.units_sold += item.quantity || 0;
        }
        
        quoteMap.set(item.product_id, existing);
      });

      // Build leaderboards
      const byQuotes: ProductQuoteData[] = Array.from(quoteMap.values())
        .map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          category: item.category,
          quote_count: item.quote_count,
          quote_value: item.quote_value,
          customer_count: item.customers.size,
        }))
        .sort((a, b) => b.quote_count - a.quote_count)
        .slice(0, limit === 0 ? undefined : limit);

      const byOrders: ProductOrderData[] = Array.from(quoteMap.values())
        .filter(item => item.order_count > 0)
        .map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          category: item.category,
          order_count: item.order_count,
          units_sold: item.units_sold,
          revenue: item.order_value,
        }))
        .sort((a, b) => b.order_count - a.order_count)
        .slice(0, limit === 0 ? undefined : limit);

      // Conversion rate: products that appear in quotes
      const byConversion: ProductConversionData[] = Array.from(quoteMap.values())
        .filter(item => item.quote_count > 0)
        .map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          category: item.category,
          quote_count: item.quote_count,
          order_count: item.order_count,
          conversion_rate: item.quote_count > 0 ? (item.order_count / item.quote_count) * 100 : 0,
        }))
        .sort((a, b) => b.conversion_rate - a.conversion_rate)
        .slice(0, limit === 0 ? undefined : limit);

      // Profit margin
      const byProfit: ProductProfitData[] = Array.from(quoteMap.values())
        .filter(item => item.purchase_price !== null && item.order_count > 0)
        .map(item => {
          const cost = (item.purchase_price || 0) * item.units_sold;
          const profit = item.order_value - cost;
          return {
            product_id: item.product_id,
            product_name: item.product_name,
            category: item.category,
            revenue: item.order_value,
            cost: cost,
            profit: profit,
            margin_pct: cost > 0 ? (profit / cost) * 100 : 0,
          };
        })
        .sort((a, b) => b.profit - a.profit)
        .slice(0, limit === 0 ? undefined : limit);

      return { byQuotes, byOrders, byConversion, byProfit };
    },
    enabled: !!user?.id,
  });
}

export function useCustomerLeaderboards(dateRange: DateRange, limit: number = 100) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['customer-leaderboards', dateRange.from?.toISOString(), dateRange.to?.toISOString(), limit],
    retry: 1,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Get sales orders with customer info
      let orderQuery = supabase
        .from('sales_orders')
        .select(`
          id,
          customer_id,
          order_value,
          created_at,
          customer:customers(
            id,
            company_name,
            industry_tag
          )
        `)
        .not('customer_id', 'is', null);

      if (dateRange.from) {
        orderQuery = orderQuery.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        orderQuery = orderQuery.lte('created_at', dateRange.to.toISOString());
      }

      // Get quotations with customer info
      let quotationQuery = supabase
        .from('quotations')
        .select(`
          id,
          customer_id,
          grand_total,
          created_at,
          is_converted,
          customer:customers(
            id,
            company_name,
            industry_tag
          )
        `)
        .is('deleted_at', null)
        .not('customer_id', 'is', null);

      if (dateRange.from) {
        quotationQuery = quotationQuery.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        quotationQuery = quotationQuery.lte('created_at', dateRange.to.toISOString());
      }

      const [orderResult, quotationResult] = await Promise.all([
        orderQuery,
        quotationQuery,
      ]);

      if (orderResult.error) throw orderResult.error;
      if (quotationResult.error) throw quotationResult.error;

      // Aggregate order data by customer
      const customerOrderMap = new Map<string, {
        customer_id: string;
        company_name: string;
        industry: string | null;
        order_count: number;
        revenue: number;
      }>();

      orderResult.data?.forEach((order: any) => {
        if (!order.customer_id || !order.customer) return;
        
        const existing = customerOrderMap.get(order.customer_id) || {
          customer_id: order.customer_id,
          company_name: order.customer.company_name,
          industry: order.customer.industry_tag,
          order_count: 0,
          revenue: 0,
        };
        
        existing.order_count += 1;
        existing.revenue += order.order_value || 0;
        
        customerOrderMap.set(order.customer_id, existing);
      });

      // Aggregate quote data by customer
      const customerQuoteMap = new Map<string, {
        customer_id: string;
        company_name: string;
        quote_count: number;
        converted_count: number;
      }>();

      quotationResult.data?.forEach((quote: any) => {
        if (!quote.customer_id || !quote.customer) return;
        
        const existing = customerQuoteMap.get(quote.customer_id) || {
          customer_id: quote.customer_id,
          company_name: quote.customer.company_name,
          quote_count: 0,
          converted_count: 0,
        };
        
        existing.quote_count += 1;
        if (quote.is_converted) {
          existing.converted_count += 1;
        }
        
        customerQuoteMap.set(quote.customer_id, existing);
      });

      // Build leaderboards
      const byRevenue: CustomerRevenueData[] = Array.from(customerOrderMap.values())
        .map(item => ({
          customer_id: item.customer_id,
          company_name: item.company_name,
          industry: item.industry,
          order_count: item.order_count,
          revenue: item.revenue,
          avg_order_value: item.order_count > 0 ? item.revenue / item.order_count : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit === 0 ? undefined : limit);

      const byOrderCount: CustomerRevenueData[] = Array.from(customerOrderMap.values())
        .map(item => ({
          customer_id: item.customer_id,
          company_name: item.company_name,
          industry: item.industry,
          order_count: item.order_count,
          revenue: item.revenue,
          avg_order_value: item.order_count > 0 ? item.revenue / item.order_count : 0,
        }))
        .sort((a, b) => b.order_count - a.order_count)
        .slice(0, limit === 0 ? undefined : limit);

      // Conversion rate by customer
      const allCustomerIds = new Set([...customerQuoteMap.keys(), ...customerOrderMap.keys()]);
      const byConversion: CustomerConversionData[] = Array.from(allCustomerIds)
        .map(customerId => {
          const quoteData = customerQuoteMap.get(customerId);
          const orderData = customerOrderMap.get(customerId);
          const quoteCount = quoteData?.quote_count || 0;
          const orderCount = orderData?.order_count || 0;
          
          return {
            customer_id: customerId,
            company_name: quoteData?.company_name || orderData?.company_name || '',
            quote_count: quoteCount,
            order_count: orderCount,
            conversion_rate: quoteCount > 0 ? (orderCount / quoteCount) * 100 : 0,
            revenue: orderData?.revenue || 0,
          };
        })
        .filter(item => item.quote_count > 0)
        .sort((a, b) => b.conversion_rate - a.conversion_rate)
        .slice(0, limit === 0 ? undefined : limit);

      return { byRevenue, byOrderCount, byConversion };
    },
    enabled: !!user?.id,
  });
}

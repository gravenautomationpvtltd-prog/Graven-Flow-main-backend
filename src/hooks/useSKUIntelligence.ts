import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, subMonths } from 'date-fns';

// Types for SKU/Product Intelligence KPIs
export interface SKUIntelligence {
  productId: string;
  productName: string;
  category: string | null;
  brand: string | null;
  hsnCode: string | null;
  
  // Core KPIs
  skuMomentumIndex: number;         // 0-100, higher = faster moving
  deadStockRisk: number;            // 0-100, higher = more risk
  
  // Supporting metrics
  quoteCount30Days: number;
  quoteCount60Days: number;
  quoteCountPrev30Days: number;     // 30-60 days ago
  orderCount30Days: number;
  orderCount60Days: number;
  orderCountPrev30Days: number;
  quoteVelocityChange: number;      // % change in quote velocity
  orderVelocityChange: number;      // % change in order velocity
  customerSpread: number;           // Unique customers quoting/ordering
  totalQuoteValue: number;
  totalOrderValue: number;
  conversionRate: number;
  
  // Supplier & Inventory metrics
  supplierDependencyPct: number;
  leadTimeDays: number;
  currentStock: number;
  
  // Classification
  momentumClassification: 'stock_promote' | 'maintain' | 'liquidate_avoid';
  deadStockClassification: 'low_risk' | 'medium_risk' | 'high_risk';
}

export function useSKUIntelligence() {
  return useQuery({
    queryKey: ['sku-intelligence'],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30).toISOString();
      const sixtyDaysAgo = subDays(now, 60).toISOString();
      const ninetyDaysAgo = subDays(now, 90).toISOString();

      // Fetch products with new intelligence fields
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          category,
          brand,
          hsn_code,
          supplier_dependency_pct,
          lead_time_days,
          is_active
        `)
        .eq('is_active', true);

      if (productsError) throw productsError;

      // Fetch quotation items for last 90 days
      const { data: quotationItems, error: qiError } = await supabase
        .from('quotation_items')
        .select(`
          id,
          product_id,
          quantity,
          amount,
          quotation_id,
          quotations!inner (
            id,
            customer_id,
            status,
            created_at
          )
        `);

      if (qiError) throw qiError;

      // Filter quotation items by date (quotations in last 90 days)
      const recentQuotationItems = (quotationItems || []).filter(qi => {
        const quotation = qi.quotations as any;
        return quotation && new Date(quotation.created_at) >= new Date(ninetyDaysAgo);
      });

      // Fetch sales order items - need to join through sales_orders
      const { data: salesOrders, error: soError } = await supabase
        .from('sales_orders')
        .select(`
          id,
          customer_id,
          quotation_id,
          created_at,
          order_value
        `)
        .gte('created_at', ninetyDaysAgo);

      if (soError) throw soError;

      // Map quotation items to orders (orders come from quotations)
      const orderQuotationIds = (salesOrders || []).map(so => so.quotation_id).filter(Boolean);

      // Fetch inventory for stock levels
      const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select(`
          product_id,
          quantity
        `);

      if (invError) throw invError;

      // Process each product
      const intelligenceData: SKUIntelligence[] = (products || []).map(product => {
        // Product quotation items
        const productQuotationItems = recentQuotationItems.filter(qi => qi.product_id === product.id);
        
        // Separate by time period
        const last30DaysItems = productQuotationItems.filter(qi => {
          const quotation = qi.quotations as any;
          return new Date(quotation.created_at) >= new Date(thirtyDaysAgo);
        });
        
        const prev30DaysItems = productQuotationItems.filter(qi => {
          const quotation = qi.quotations as any;
          const createdAt = new Date(quotation.created_at);
          return createdAt >= new Date(sixtyDaysAgo) && createdAt < new Date(thirtyDaysAgo);
        });

        const last60DaysItems = productQuotationItems.filter(qi => {
          const quotation = qi.quotations as any;
          return new Date(quotation.created_at) >= new Date(sixtyDaysAgo);
        });

        // Quote counts
        const quoteCount30Days = last30DaysItems.length;
        const quoteCountPrev30Days = prev30DaysItems.length;
        const quoteCount60Days = last60DaysItems.length;

        // Order counts (items in quotations that converted to orders)
        const orderItems30Days = last30DaysItems.filter(qi => {
          const quotation = qi.quotations as any;
          return orderQuotationIds.includes(quotation.id);
        });
        const orderItemsPrev30Days = prev30DaysItems.filter(qi => {
          const quotation = qi.quotations as any;
          return orderQuotationIds.includes(quotation.id);
        });
        const orderItems60Days = last60DaysItems.filter(qi => {
          const quotation = qi.quotations as any;
          return orderQuotationIds.includes(quotation.id);
        });

        const orderCount30Days = orderItems30Days.length;
        const orderCountPrev30Days = orderItemsPrev30Days.length;
        const orderCount60Days = orderItems60Days.length;

        // Velocity changes (% change from prev 30 days to current 30 days)
        const quoteVelocityChange = quoteCountPrev30Days > 0 
          ? ((quoteCount30Days - quoteCountPrev30Days) / quoteCountPrev30Days) * 100
          : quoteCount30Days > 0 ? 100 : 0;

        const orderVelocityChange = orderCountPrev30Days > 0
          ? ((orderCount30Days - orderCountPrev30Days) / orderCountPrev30Days) * 100
          : orderCount30Days > 0 ? 100 : 0;

        // Customer spread (unique customers)
        const uniqueCustomers = new Set(
          productQuotationItems.map(qi => (qi.quotations as any)?.customer_id).filter(Boolean)
        );
        const customerSpread = uniqueCustomers.size;

        // Values
        const totalQuoteValue = productQuotationItems.reduce((sum, qi) => sum + (qi.amount || 0), 0);
        const totalOrderValue = productQuotationItems
          .filter(qi => orderQuotationIds.includes((qi.quotations as any)?.id))
          .reduce((sum, qi) => sum + (qi.amount || 0), 0);

        // Conversion rate
        const conversionRate = quoteCount60Days > 0 
          ? (orderCount60Days / quoteCount60Days) * 100 
          : 0;

        // Stock level
        const productInventory = (inventory || []).filter(inv => inv.product_id === product.id);
        const currentStock = productInventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0);

        // === SKU MOMENTUM INDEX (0-100) ===
        // Formula: (Quote Velocity Change × 40) + (Order Velocity Change × 40) + (Customer Spread × 20)
        const normalizedQuoteVelocity = Math.min(100, Math.max(-100, quoteVelocityChange));
        const normalizedOrderVelocity = Math.min(100, Math.max(-100, orderVelocityChange));
        const normalizedCustomerSpread = Math.min(100, customerSpread * 10);

        const skuMomentumIndex = Math.round(
          50 + // Base score
          ((normalizedQuoteVelocity / 100) * 40 * 0.5) +
          ((normalizedOrderVelocity / 100) * 40 * 0.5) +
          (normalizedCustomerSpread * 0.20)
        );

        // === DEAD STOCK RISK (0-100) ===
        // Formula: (High Quotes No Orders × 40) + (Supplier Lead Time × 30) + (Market Momentum Decline × 30)
        
        // High quotes but no orders = risk
        const highQuotesNoOrdersRisk = quoteCount60Days > 0 && orderCount60Days === 0 
          ? 100 
          : quoteCount60Days > orderCount60Days * 3 
            ? 70 
            : 0;

        // Supplier lead time risk (longer = higher risk)
        const leadTimeRisk = Math.min(100, ((product.lead_time_days || 0) / 30) * 100);

        // Market momentum decline (negative velocity = risk)
        const momentumDeclineRisk = orderVelocityChange < -20 
          ? Math.min(100, Math.abs(orderVelocityChange)) 
          : 0;

        const deadStockRisk = Math.round(
          (highQuotesNoOrdersRisk * 0.40) +
          (leadTimeRisk * 0.30) +
          (momentumDeclineRisk * 0.30)
        );

        // Classifications
        const momentumClassification: SKUIntelligence['momentumClassification'] =
          skuMomentumIndex > 70 ? 'stock_promote' :
          skuMomentumIndex >= 40 ? 'maintain' : 'liquidate_avoid';

        const deadStockClassification: SKUIntelligence['deadStockClassification'] =
          deadStockRisk < 30 ? 'low_risk' :
          deadStockRisk < 60 ? 'medium_risk' : 'high_risk';

        return {
          productId: product.id,
          productName: product.name,
          category: product.category,
          brand: product.brand,
          hsnCode: product.hsn_code,
          skuMomentumIndex: Math.max(0, Math.min(100, skuMomentumIndex)),
          deadStockRisk: Math.max(0, Math.min(100, deadStockRisk)),
          quoteCount30Days,
          quoteCount60Days,
          quoteCountPrev30Days,
          orderCount30Days,
          orderCount60Days,
          orderCountPrev30Days,
          quoteVelocityChange: Math.round(quoteVelocityChange * 10) / 10,
          orderVelocityChange: Math.round(orderVelocityChange * 10) / 10,
          customerSpread,
          totalQuoteValue,
          totalOrderValue,
          conversionRate: Math.round(conversionRate * 10) / 10,
          supplierDependencyPct: product.supplier_dependency_pct || 0,
          leadTimeDays: product.lead_time_days || 0,
          currentStock,
          momentumClassification,
          deadStockClassification,
        };
      });

      // Sort by momentum index descending
      return intelligenceData.sort((a, b) => b.skuMomentumIndex - a.skuMomentumIndex);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get single SKU intelligence
export function useSKUIntelligenceById(productId: string | undefined) {
  const { data: allIntelligence, isLoading, error } = useSKUIntelligence();
  
  const productData = productId 
    ? allIntelligence?.find(p => p.productId === productId) 
    : undefined;

  return { data: productData, isLoading, error };
}

// Get high-risk SKUs (dead stock alerts)
export function useDeadStockAlerts() {
  const { data: allIntelligence, isLoading, error } = useSKUIntelligence();
  
  const highRisk = allIntelligence?.filter(p => 
    p.deadStockClassification === 'high_risk' ||
    p.momentumClassification === 'liquidate_avoid'
  );

  return { data: highRisk, isLoading, error };
}

// Get trending SKUs (for promotion)
export function useTrendingSKUs() {
  const { data: allIntelligence, isLoading, error } = useSKUIntelligence();
  
  const trending = allIntelligence?.filter(p => 
    p.momentumClassification === 'stock_promote' &&
    p.skuMomentumIndex >= 70
  );

  return { data: trending, isLoading, error };
}

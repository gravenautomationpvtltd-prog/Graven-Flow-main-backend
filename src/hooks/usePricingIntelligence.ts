import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ensureFreshSession } from '@/utils/sessionGuard';

export interface ProductPricingMetrics {
  product_id: string;
  product_name: string;
  times_quoted: number;
  times_won: number;
  times_lost: number;
  avg_initial_price: number;
  avg_target_price: number | null;
  avg_final_price: number | null;
  win_rate: number;
  avg_gap_to_target: number | null;
  total_revenue: number;
  order_count?: number;
}

export interface SupplierCorrelation {
  supplier_id: string;
  supplier_name: string;
  products_supplied: number;
  orders_won: number;
  orders_lost: number;
  win_rate: number;
  avg_price_competitiveness: number | null;
}

export interface SupplierPerformanceDetail {
  supplier_id: string;
  supplier_name: string;
  total_products: number;
  total_enquiries: number;
  enquiries_won: number;
  enquiries_lost: number;
  enquiries_pending: number;
  win_rate: number;
  avg_price_gap: number | null;
  total_revenue_won: number;
  total_revenue_lost: number;
  recommendation: 'top_performer' | 'good' | 'needs_review' | 'renegotiate';
  products: {
    product_id: string;
    product_name: string;
    times_quoted: number;
    won: number;
    lost: number;
    avg_quoted_rate: number;
  }[];
}

export interface WinLossDetail {
  id: string;
  lead_id: string;
  lead_title: string;
  customer_name: string;
  product_name: string;
  initial_rate: number;
  target_rate: number | null;
  final_rate: number | null;
  gap_to_target: number | null;
  outcome: 'won' | 'lost' | 'pending';
  reason: string | null;
  created_at: string;
  // Penny-level details
  quantity: number;
  unit: string;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  total_amount: number;
  quotation_id: string | null;
  quotation_number: string | null;
}

export interface PricingTrend {
  month: string;
  avg_gap_percent: number;
  win_rate: number;
  total_quotes: number;
}

export interface PricingKPIs {
  overall_win_rate: number;
  avg_negotiation_gap: number;
  price_match_rate: number;
  total_quotes_analyzed: number;
  total_revenue_won: number;
  total_revenue_lost: number;
}

export interface ProductPriceHistoryEntry {
  id: string;
  product_id: string;
  old_rate: number | null;
  new_rate: number;
  supplier_id: string | null;
  supplier_name: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
  change_reason: string | null;
  source: string;
  reference_id: string | null;
  created_at: string;
}

export interface ProductQuotation {
  quotation_id: string;
  quotation_number: string;
  lead_id: string;
  lead_title: string;
  customer_name: string;
  quantity: number;
  rate: number;
  amount: number;
  lead_status: string;
  created_at: string;
}

export interface ProductNegotiation {
  id: string;
  lead_id: string;
  lead_title: string;
  customer_name: string;
  initial_quoted_rate: number;
  target_rate: number | null;
  final_rate: number | null;
  price_gap: number | null;
  outcome: 'won' | 'lost' | 'pending';
  notes: string | null;
  created_at: string;
}

// Fetch product pricing performance metrics with pagination
export type PricingSortOption = 'most_quoted' | 'revenue' | 'orders' | 'win_rate' | 'name';

export function useProductPricingMetrics(
  page: number = 1, 
  pageSize: number = 25, 
  search: string = '',
  sortBy: PricingSortOption = 'most_quoted'
) {
  return useQuery({
    queryKey: ['pricing-intelligence', 'product-metrics', page, pageSize, search, sortBy],
    queryFn: async (): Promise<{ data: ProductPricingMetrics[]; totalCount: number }> => {
      // Step 1: Fetch ALL products first
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)
        .limit(15000);

      if (productsError) throw productsError;

      // Step 2: Fetch quotation items with lead outcomes for win/loss tracking
      const { data: quotationItems, error: qiError } = await supabase
        .from('quotation_items')
        .select(`
          id,
          product_id,
          quantity,
          rate,
          amount,
          quotation:quotations!inner (
            id,
            lead:leads (
              id,
              status
            )
          )
        `)
        .not('product_id', 'is', null)
        .limit(100000);

      if (qiError) throw qiError;

      // Step 3: Aggregate quotation data by product
      const productMetrics = new Map<string, {
        quotes: number;
        won: number;
        lost: number;
        rates: number[];
        final_rates: number[];
        revenue: number;
        total_quantity: number;
      }>();

      quotationItems?.forEach(item => {
        const productId = item.product_id as string;
        const leadStatus = (item.quotation as any)?.lead?.status as string;

        if (!productMetrics.has(productId)) {
          productMetrics.set(productId, {
            quotes: 0,
            won: 0,
            lost: 0,
            rates: [],
            final_rates: [],
            revenue: 0,
            total_quantity: 0,
          });
        }

        const metrics = productMetrics.get(productId)!;
        metrics.quotes++;
        metrics.rates.push(item.rate || 0);
        metrics.total_quantity += item.quantity || 0;

        if (leadStatus === 'won') {
          metrics.won++;
          metrics.final_rates.push(item.rate || 0);
          metrics.revenue += item.amount || 0;
        } else if (leadStatus === 'lost') {
          metrics.lost++;
        }
      });

      // Step 4: Merge all products with their metrics
      let allMetrics: ProductPricingMetrics[] = (allProducts || []).map(product => {
        const pMetrics = productMetrics.get(product.id);

        const timesQuoted = pMetrics?.quotes || 0;
        const timesWon = pMetrics?.won || 0;
        const timesLost = pMetrics?.lost || 0;
        const totalRevenue = pMetrics?.revenue || 0;

        return {
          product_id: product.id,
          product_name: product.name,
          times_quoted: timesQuoted,
          times_won: timesWon,
          times_lost: timesLost,
          avg_initial_price: pMetrics?.rates.length ? 
            pMetrics.rates.reduce((a, b) => a + b, 0) / pMetrics.rates.length : 0,
          avg_target_price: null,
          avg_final_price: pMetrics?.final_rates.length ? 
            pMetrics.final_rates.reduce((a, b) => a + b, 0) / pMetrics.final_rates.length : null,
          win_rate: (timesWon + timesLost) > 0 ? (timesWon / (timesWon + timesLost)) * 100 : 0,
          avg_gap_to_target: null,
          total_revenue: totalRevenue,
          order_count: timesWon, // Orders = won quotes
        };
      });

      // Step 5: Apply search filter
      if (search) {
        allMetrics = allMetrics.filter(m => 
          m.product_name.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Step 6: Sort based on sortBy parameter
      switch (sortBy) {
        case 'most_quoted':
          allMetrics.sort((a, b) => b.times_quoted - a.times_quoted);
          break;
        case 'revenue':
          allMetrics.sort((a, b) => b.total_revenue - a.total_revenue);
          break;
        case 'orders':
          allMetrics.sort((a, b) => (b.order_count || 0) - (a.order_count || 0));
          break;
        case 'win_rate':
          allMetrics.sort((a, b) => b.win_rate - a.win_rate);
          break;
        case 'name':
          allMetrics.sort((a, b) => a.product_name.localeCompare(b.product_name));
          break;
        default:
          allMetrics.sort((a, b) => b.times_quoted - a.times_quoted);
      }

      const totalCount = allMetrics.length;
      const startIndex = (page - 1) * pageSize;
      const paginatedData = allMetrics.slice(startIndex, startIndex + pageSize);

      return { data: paginatedData, totalCount };
    },
  });
}

// Fetch price history for a specific product
export function useProductPriceHistory(productId: string | null) {
  return useQuery({
    queryKey: ['pricing-intelligence', 'price-history', productId],
    queryFn: async (): Promise<ProductPriceHistoryEntry[]> => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('product_price_history')
        .select(`
          id,
          product_id,
          old_rate,
          new_rate,
          supplier_id,
          changed_by,
          change_reason,
          source,
          reference_id,
          created_at,
          supplier:suppliers (name),
          changed_by_profile:profiles!product_price_history_changed_by_fkey (full_name)
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(d => ({
        id: d.id,
        product_id: d.product_id,
        old_rate: d.old_rate,
        new_rate: d.new_rate,
        supplier_id: d.supplier_id,
        supplier_name: (d.supplier as any)?.name || null,
        changed_by: d.changed_by,
        changed_by_name: (d.changed_by_profile as any)?.full_name || null,
        change_reason: d.change_reason,
        source: d.source || 'manual',
        reference_id: d.reference_id,
        created_at: d.created_at,
      }));
    },
    enabled: !!productId,
  });
}

// Fetch quotations for a specific product
export function useProductQuotations(productId: string | null) {
  return useQuery({
    queryKey: ['pricing-intelligence', 'product-quotations', productId],
    queryFn: async (): Promise<ProductQuotation[]> => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('quotation_items')
        .select(`
          id,
          quantity,
          rate,
          amount,
          quotation:quotations!inner (
            id,
            quotation_number,
            created_at,
            lead:leads!inner (
              id,
              title,
              status,
              customer:customers (
                company_name
              )
            )
          )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(d => ({
        quotation_id: (d.quotation as any)?.id,
        quotation_number: (d.quotation as any)?.quotation_number || 'Unknown',
        lead_id: (d.quotation as any)?.lead?.id,
        lead_title: (d.quotation as any)?.lead?.title || 'Unknown Lead',
        customer_name: (d.quotation as any)?.lead?.customer?.company_name || 'Unknown Customer',
        quantity: d.quantity || 0,
        rate: d.rate || 0,
        amount: d.amount || 0,
        lead_status: (d.quotation as any)?.lead?.status || 'unknown',
        created_at: (d.quotation as any)?.created_at,
      }));
    },
    enabled: !!productId,
  });
}

// Fetch negotiations for a specific product
export function useProductNegotiations(productId: string | null) {
  return useQuery({
    queryKey: ['pricing-intelligence', 'product-negotiations', productId],
    queryFn: async (): Promise<ProductNegotiation[]> => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('quotation_item_negotiations')
        .select(`
          id,
          lead_id,
          initial_quoted_rate,
          target_rate,
          final_rate,
          price_gap,
          outcome,
          created_at,
          lead:leads (
            id,
            title,
            customer:customers (
              company_name
            )
          )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((d: any) => ({
        id: d.id,
        lead_id: d.lead_id,
        lead_title: d.lead?.title || 'Unknown Lead',
        customer_name: d.lead?.customer?.company_name || 'Unknown Customer',
        initial_quoted_rate: d.initial_quoted_rate,
        target_rate: d.target_rate,
        final_rate: d.final_rate,
        price_gap: d.price_gap,
        outcome: d.outcome as 'won' | 'lost' | 'pending',
        notes: null,
        created_at: d.created_at,
      }));
    },
    enabled: !!productId,
  });
}

// Create negotiation record
export function useCreateNegotiation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      lead_id: string;
      product_id: string;
      product_name: string;
      initial_quoted_rate: number;
      target_rate?: number;
      final_rate?: number;
      outcome?: 'won' | 'lost' | 'pending';
      notes?: string;
    }) => {
      const price_gap = data.target_rate && data.initial_quoted_rate 
        ? data.initial_quoted_rate - data.target_rate 
        : null;

      await ensureFreshSession();
      const { data: result, error } = await supabase
        .from('quotation_item_negotiations')
        .insert({
          lead_id: data.lead_id,
          product_id: data.product_id,
          product_name: data.product_name,
          initial_quoted_rate: data.initial_quoted_rate,
          target_rate: data.target_rate || null,
          final_rate: data.final_rate || null,
          price_gap,
          outcome: data.outcome || 'pending',
        } as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-intelligence'] });
      toast.success('Negotiation record created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create negotiation: ' + error.message);
    },
  });
}

// Update negotiation record
export function useUpdateNegotiation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      initial_quoted_rate?: number;
      target_rate?: number | null;
      final_rate?: number | null;
      outcome?: 'won' | 'lost' | 'pending';
      notes?: string | null;
    }) => {
      const updateData: any = {};
      if (data.initial_quoted_rate !== undefined) updateData.initial_quoted_rate = data.initial_quoted_rate;
      if (data.target_rate !== undefined) updateData.target_rate = data.target_rate;
      if (data.final_rate !== undefined) updateData.final_rate = data.final_rate;
      if (data.outcome !== undefined) updateData.outcome = data.outcome;
      if (data.notes !== undefined) updateData.notes = data.notes;

      // Calculate price gap if we have the rates
      if (updateData.initial_quoted_rate && updateData.target_rate) {
        updateData.price_gap = updateData.initial_quoted_rate - updateData.target_rate;
      }

      await ensureFreshSession();
      const { data: result, error } = await supabase
        .from('quotation_item_negotiations')
        .update(updateData)
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-intelligence'] });
      toast.success('Negotiation updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update negotiation: ' + error.message);
    },
  });
}

// Delete negotiation record
export function useDeleteNegotiation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quotation_item_negotiations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-intelligence'] });
      toast.success('Negotiation deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete negotiation: ' + error.message);
    },
  });
}

// Fetch supplier correlation data
export function useSupplierCorrelation() {
  return useQuery({
    queryKey: ['pricing-intelligence', 'supplier-correlation'],
    queryFn: async (): Promise<SupplierCorrelation[]> => {
      const { data: enquiryItems, error } = await supabase
        .from('enquiry_items')
        .select(`
          id,
          supplier_id,
          matched_product_id,
          lead:leads!inner (
            id,
            status
          ),
          supplier:suppliers (
            id,
            name
          )
        `)
        .not('supplier_id', 'is', null);

      if (error) throw error;

      const supplierMetrics = new Map<string, {
        supplier_id: string;
        supplier_name: string;
        products: Set<string>;
        won: number;
        lost: number;
      }>();

      enquiryItems?.forEach(item => {
        const supplierId = item.supplier_id as string;
        const supplier = item.supplier as any;
        const leadStatus = (item.lead as any)?.status as string;

        if (!supplierMetrics.has(supplierId)) {
          supplierMetrics.set(supplierId, {
            supplier_id: supplierId,
            supplier_name: supplier?.name || 'Unknown',
            products: new Set(),
            won: 0,
            lost: 0,
          });
        }

        const metrics = supplierMetrics.get(supplierId)!;
        if (item.matched_product_id) {
          metrics.products.add(item.matched_product_id);
        }

        if (leadStatus === 'won') {
          metrics.won++;
        } else if (leadStatus === 'lost') {
          metrics.lost++;
        }
      });

      return Array.from(supplierMetrics.values()).map(m => ({
        supplier_id: m.supplier_id,
        supplier_name: m.supplier_name,
        products_supplied: m.products.size,
        orders_won: m.won,
        orders_lost: m.lost,
        win_rate: (m.won + m.lost) > 0 ? (m.won / (m.won + m.lost)) * 100 : 0,
        avg_price_competitiveness: null,
      })).sort((a, b) => (b.orders_won + b.orders_lost) - (a.orders_won + a.orders_lost));
    },
  });
}

// Fetch detailed supplier performance analytics
export function useSupplierPerformanceAnalytics() {
  return useQuery({
    queryKey: ['pricing-intelligence', 'supplier-performance'],
    queryFn: async (): Promise<SupplierPerformanceDetail[]> => {
      // Get enquiry items with supplier and lead data
      const { data: enquiryItems, error: enquiryError } = await supabase
        .from('enquiry_items')
        .select(`
          id,
          supplier_id,
          matched_product_id,
          product_query_text,
          lead:leads!inner (
            id,
            status,
            estimated_value,
            customer:customers (
              company_name
            )
          ),
          supplier:suppliers (
            id,
            name
          ),
          product:products (
            id,
            name,
            default_rate
          )
        `)
        .not('supplier_id', 'is', null);

      if (enquiryError) throw enquiryError;

      // Get quotation items for pricing data
      const { data: quotationItems, error: quotationError } = await supabase
        .from('quotation_items')
        .select(`
          id,
          product_id,
          rate,
          amount,
          quotation:quotations!inner (
            id,
            lead:leads!inner (
              id,
              status
            )
          )
        `)
        .not('product_id', 'is', null);

      if (quotationError) throw quotationError;

      // Build product-to-rates map from quotations
      const productRatesMap = new Map<string, { rates: number[]; amounts: number[]; won: number; lost: number }>();
      quotationItems?.forEach(item => {
        const productId = item.product_id as string;
        const leadStatus = (item.quotation as any)?.lead?.status as string;
        
        if (!productRatesMap.has(productId)) {
          productRatesMap.set(productId, { rates: [], amounts: [], won: 0, lost: 0 });
        }
        
        const data = productRatesMap.get(productId)!;
        data.rates.push(item.rate || 0);
        data.amounts.push(item.amount || 0);
        if (leadStatus === 'won') data.won++;
        if (leadStatus === 'lost') data.lost++;
      });

      // Aggregate by supplier
      const supplierData = new Map<string, {
        supplier_id: string;
        supplier_name: string;
        products: Map<string, {
          product_id: string;
          product_name: string;
          quotes: number;
          won: number;
          lost: number;
          rates: number[];
        }>;
        enquiries_won: number;
        enquiries_lost: number;
        enquiries_pending: number;
        revenue_won: number;
        revenue_lost: number;
      }>();

      enquiryItems?.forEach(item => {
        const supplierId = item.supplier_id as string;
        const supplier = item.supplier as any;
        const leadStatus = (item.lead as any)?.status as string;
        const estimatedValue = (item.lead as any)?.estimated_value || 0;
        const productId = item.matched_product_id;
        const productName = (item.product as any)?.name || item.product_query_text || 'Unknown';

        if (!supplierData.has(supplierId)) {
          supplierData.set(supplierId, {
            supplier_id: supplierId,
            supplier_name: supplier?.name || 'Unknown Supplier',
            products: new Map(),
            enquiries_won: 0,
            enquiries_lost: 0,
            enquiries_pending: 0,
            revenue_won: 0,
            revenue_lost: 0,
          });
        }

        const data = supplierData.get(supplierId)!;

        // Track product data
        if (productId) {
          if (!data.products.has(productId)) {
            const productRateData = productRatesMap.get(productId);
            data.products.set(productId, {
              product_id: productId,
              product_name: productName,
              quotes: productRateData ? productRateData.rates.length : 0,
              won: productRateData ? productRateData.won : 0,
              lost: productRateData ? productRateData.lost : 0,
              rates: productRateData ? productRateData.rates : [],
            });
          }
        }

        // Track win/loss/pending
        if (leadStatus === 'won') {
          data.enquiries_won++;
          data.revenue_won += estimatedValue;
        } else if (leadStatus === 'lost') {
          data.enquiries_lost++;
          data.revenue_lost += estimatedValue;
        } else {
          data.enquiries_pending++;
        }
      });

      // Convert to array with recommendations
      return Array.from(supplierData.values()).map(d => {
        const totalDecided = d.enquiries_won + d.enquiries_lost;
        const winRate = totalDecided > 0 ? (d.enquiries_won / totalDecided) * 100 : 0;
        
        // Determine recommendation
        let recommendation: SupplierPerformanceDetail['recommendation'];
        if (winRate >= 70 && totalDecided >= 3) {
          recommendation = 'top_performer';
        } else if (winRate >= 50) {
          recommendation = 'good';
        } else if (winRate >= 30 || totalDecided < 3) {
          recommendation = 'needs_review';
        } else {
          recommendation = 'renegotiate';
        }

        return {
          supplier_id: d.supplier_id,
          supplier_name: d.supplier_name,
          total_products: d.products.size,
          total_enquiries: d.enquiries_won + d.enquiries_lost + d.enquiries_pending,
          enquiries_won: d.enquiries_won,
          enquiries_lost: d.enquiries_lost,
          enquiries_pending: d.enquiries_pending,
          win_rate: winRate,
          avg_price_gap: null,
          total_revenue_won: d.revenue_won,
          total_revenue_lost: d.revenue_lost,
          recommendation,
          products: Array.from(d.products.values()).map(p => ({
            product_id: p.product_id,
            product_name: p.product_name,
            times_quoted: p.quotes,
            won: p.won,
            lost: p.lost,
            avg_quoted_rate: p.rates.length > 0 ? p.rates.reduce((a, b) => a + b, 0) / p.rates.length : 0,
          })),
        };
      }).sort((a, b) => b.total_enquiries - a.total_enquiries);
    },
  });
}

// Fetch win/loss details - NO LIMIT for complete data with penny-level details
export function useWinLossDetails(dateRange?: { from: Date | null; to: Date | null }) {
  return useQuery({
    queryKey: ['pricing-intelligence', 'win-loss-details', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<WinLossDetail[]> => {
      // Fetch negotiations with quotation item details
      let query = supabase
        .from('quotation_item_negotiations')
        .select(`
          id,
          lead_id,
          product_id,
          product_name,
          initial_quoted_rate,
          target_rate,
          final_rate,
          price_gap,
          outcome,
          created_at,
          quotation_item_id,
          quotation_id,
          lead:leads (
            id,
            title,
            won_reason,
            lost_reason,
            customer:customers (
              company_name
            )
          ),
          quotation:quotations (
            id,
            quotation_number
          )
        `)
        .order('created_at', { ascending: false });

      // Apply date range filter
      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data: negotiations, error } = await query;

      if (error) throw error;

      // Get quotation item IDs that exist
      const quotationItemIds = (negotiations || [])
        .map(n => (n as any).quotation_item_id)
        .filter(Boolean);

      // Fetch quotation items for penny-level details if we have IDs
      let quotationItemsMap = new Map<string, any>();
      if (quotationItemIds.length > 0) {
        const { data: quotationItems, error: qiError } = await supabase
          .from('quotation_items')
          .select(`
            id,
            quantity,
            unit,
            rate,
            amount,
            discount_percent,
            discount_amount,
            tax_percent,
            tax_amount
          `)
          .in('id', quotationItemIds);

        if (!qiError && quotationItems) {
          quotationItems.forEach(item => {
            quotationItemsMap.set(item.id, item);
          });
        }
      }

      return (negotiations || []).map(n => {
        const leadData = n.lead as any;
        const quotationData = (n as any).quotation as any;
        const outcome = n.outcome as 'won' | 'lost' | 'pending';
        const quotationItemId = (n as any).quotation_item_id as string;
        const quotationItem = quotationItemsMap.get(quotationItemId);
        
        // Determine reason based on outcome
        const reason = outcome === 'won' 
          ? leadData?.won_reason 
          : outcome === 'lost' 
            ? leadData?.lost_reason 
            : null;

        // Calculate penny-level details
        const quantity = quotationItem?.quantity || 1;
        const unitRate = n.final_rate || n.initial_quoted_rate || 0;
        const subtotal = unitRate * quantity;
        const discountPercent = quotationItem?.discount_percent || 0;
        const discountAmount = quotationItem?.discount_amount || 0;
        const taxPercent = quotationItem?.tax_percent || 18;
        const taxAmount = quotationItem?.tax_amount || (subtotal - discountAmount) * (taxPercent / 100);
        const totalAmount = quotationItem?.amount || (subtotal - discountAmount + taxAmount);

        return {
          id: n.id,
          lead_id: n.lead_id,
          lead_title: leadData?.title || 'Unknown Lead',
          customer_name: leadData?.customer?.company_name || 'Unknown Customer',
          product_name: n.product_name || 'Unknown Product',
          initial_rate: n.initial_quoted_rate,
          target_rate: n.target_rate,
          final_rate: n.final_rate,
          gap_to_target: n.price_gap,
          outcome,
          reason,
          created_at: n.created_at,
          // Penny-level details
          quantity,
          unit: quotationItem?.unit || 'Nos',
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          tax_percent: taxPercent,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          quotation_id: (n as any).quotation_id || quotationData?.id || null,
          quotation_number: quotationData?.quotation_number || null,
        };
      });
    },
  });
}

// Fetch pricing trends with date range support
export function usePricingTrends(dateRange?: { from: Date | null; to: Date | null }) {
  return useQuery({
    queryKey: ['pricing-intelligence', 'trends', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<PricingTrend[]> => {
      // Default to 6 months if no date range provided
      const startDate = dateRange?.from || (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 6);
        return d;
      })();
      const endDate = dateRange?.to || new Date();

      let query = supabase
        .from('quotations')
        .select(`
          id,
          created_at,
          is_price_matched,
          lead:leads!inner (
            status
          )
        `)
        .gte('created_at', startDate.toISOString());
      
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data: quotations, error } = await query;

      if (error) throw error;

      const monthlyData = new Map<string, {
        total: number;
        won: number;
        matched: number;
      }>();

      quotations?.forEach(q => {
        const month = new Date(q.created_at).toLocaleString('default', { month: 'short', year: 'numeric' });
        const leadStatus = (q.lead as any)?.status as string;

        if (!monthlyData.has(month)) {
          monthlyData.set(month, { total: 0, won: 0, matched: 0 });
        }

        const data = monthlyData.get(month)!;
        data.total++;
        if (leadStatus === 'won') data.won++;
        if (q.is_price_matched) data.matched++;
      });

      return Array.from(monthlyData.entries()).map(([month, data]) => ({
        month,
        avg_gap_percent: data.matched > 0 ? (data.matched / data.total) * 100 : 0,
        win_rate: data.total > 0 ? (data.won / data.total) * 100 : 0,
        total_quotes: data.total,
      }));
    },
  });
}

// Fetch KPIs with date range support - uses ACTUAL order values
export function usePricingKPIs(dateRange?: { from: Date | null; to: Date | null }) {
  return useQuery({
    queryKey: ['pricing-intelligence', 'kpis', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<PricingKPIs> => {
      // Fetch leads with their status
      let leadsQuery = supabase
        .from('leads')
        .select('id, status')
        .in('status', ['won', 'lost']);
      
      if (dateRange?.from) {
        leadsQuery = leadsQuery.gte('updated_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        leadsQuery = leadsQuery.lte('updated_at', dateRange.to.toISOString());
      }
      
      const { data: leads, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;
      
      const wonLeads = leads?.filter(l => l.status === 'won') || [];
      const lostLeads = leads?.filter(l => l.status === 'lost') || [];
      
      // Get ACTUAL order values for won leads
      let revenueWon = 0;
      if (wonLeads.length > 0) {
        const wonLeadIds = wonLeads.map(l => l.id);
        const { data: orders } = await supabase
          .from('sales_orders')
          .select('order_value')
          .in('lead_id', wonLeadIds);
        revenueWon = orders?.reduce((sum, o) => sum + (o.order_value || 0), 0) || 0;
      }
      
      // Get latest quotation values for lost leads
      let revenueLost = 0;
      if (lostLeads.length > 0) {
        const lostLeadIds = lostLeads.map(l => l.id);
        const { data: quotations } = await supabase
          .from('quotations')
          .select('lead_id, grand_total, created_at')
          .in('lead_id', lostLeadIds)
          .order('created_at', { ascending: false });
        
        // Take latest quotation per lead
        const seenLeads = new Set<string>();
        quotations?.forEach(q => {
          if (q.lead_id && !seenLeads.has(q.lead_id)) {
            revenueLost += q.grand_total || 0;
            seenLeads.add(q.lead_id);
          }
        });
      }
      
      // Get quotation stats for price match rate
      let quotationsQuery = supabase
        .from('quotations')
        .select('id, is_price_matched');
      
      if (dateRange?.from) {
        quotationsQuery = quotationsQuery.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        quotationsQuery = quotationsQuery.lte('created_at', dateRange.to.toISOString());
      }
      
      const { data: quotations, error: quotationsError } = await quotationsQuery;
      if (quotationsError) throw quotationsError;
      
      const matched = quotations?.filter(q => q.is_price_matched).length || 0;
      const totalDecided = wonLeads.length + lostLeads.length;

      return {
        overall_win_rate: totalDecided > 0 ? (wonLeads.length / totalDecided) * 100 : 0,
        avg_negotiation_gap: 0,
        price_match_rate: quotations && quotations.length > 0 ? (matched / quotations.length) * 100 : 0,
        total_quotes_analyzed: quotations?.length || 0,
        total_revenue_won: revenueWon,
        total_revenue_lost: revenueLost,
      };
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Products losing deals due to price
export interface PriceRelatedLoss {
  product_id: string;
  product_name: string;
  times_lost_to_price: number;
  total_times_lost: number;
  lost_revenue: number;
  avg_quoted_rate: number;
  suggested_action: 'review_pricing' | 'find_supplier' | 'discontinue';
}

// Products with favorable win rates
export interface FavorablePriceProduct {
  product_id: string;
  product_name: string;
  win_rate: number;
  times_won: number;
  times_quoted: number;
  total_revenue: number;
  recommendation: 'stock_more' | 'upsell' | 'premium_product';
}

// Customers needing price attention
export interface CustomerPriceSensitivity {
  customer_id: string;
  company_name: string;
  total_quotes_received: number;
  quotes_lost_to_price: number;
  price_sensitivity_score: number; // 0-100
  total_potential_revenue: number;
  last_quote_date: string | null;
  recommendation: 'offer_discount' | 'focus_value' | 'deprioritize';
}

// Overall pricing health metrics
export interface PricingHealthMetrics {
  total_quotes_analyzed: number;
  total_won: number;
  total_lost: number;
  lost_to_price: number;
  overall_win_rate: number;
  price_related_loss_rate: number;
  total_revenue_won: number;
  total_revenue_lost_to_price: number;
}

// Data quality status
export interface DataQualityStatus {
  has_sufficient_data: boolean;
  leads_with_outcomes: number;
  leads_with_lost_reasons: number;
  quotations_count: number;
  negotiation_records: number;
  products_quoted: number;
  data_issues: string[];
}

export function usePriceRelatedLosses(limit: number = 20) {
  return useQuery({
    queryKey: ['actionable-pricing', 'price-losses', limit],
    queryFn: async (): Promise<PriceRelatedLoss[]> => {
      // Get negotiations with lost outcomes
      const { data: negotiations, error } = await supabase
        .from('quotation_item_negotiations')
        .select(`
          id,
          product_id,
          product_name,
          initial_quoted_rate,
          outcome,
          lead:leads (
            id,
            lost_reason,
            estimated_value
          )
        `)
        .eq('outcome', 'lost')
        .not('product_id', 'is', null);

      if (error) throw error;

      // Aggregate by product
      const productLosses = new Map<string, {
        product_name: string;
        times_lost_to_price: number;
        total_times_lost: number;
        lost_revenue: number;
        rates: number[];
      }>();

      negotiations?.forEach((neg: any) => {
        const productId = neg.product_id;
        const lostReason = neg.lead?.lost_reason || '';
        const isPriceLoss = lostReason.toLowerCase().includes('price') || 
                           lostReason === 'price_too_high' ||
                           lostReason === 'better_price_elsewhere';
        
        if (!productLosses.has(productId)) {
          productLosses.set(productId, {
            product_name: neg.product_name || 'Unknown Product',
            times_lost_to_price: 0,
            total_times_lost: 0,
            lost_revenue: 0,
            rates: []
          });
        }

        const data = productLosses.get(productId)!;
        data.total_times_lost++;
        data.rates.push(neg.initial_quoted_rate || 0);
        data.lost_revenue += neg.lead?.estimated_value || neg.initial_quoted_rate || 0;
        
        if (isPriceLoss) {
          data.times_lost_to_price++;
        }
      });

      // Convert to array and sort by lost revenue
      const results: PriceRelatedLoss[] = Array.from(productLosses.entries())
        .map(([product_id, data]) => ({
          product_id,
          product_name: data.product_name,
          times_lost_to_price: data.times_lost_to_price,
          total_times_lost: data.total_times_lost,
          lost_revenue: data.lost_revenue,
          avg_quoted_rate: data.rates.length > 0 
            ? data.rates.reduce((a, b) => a + b, 0) / data.rates.length 
            : 0,
          suggested_action: (data.times_lost_to_price >= 3 
            ? 'review_pricing' 
            : data.total_times_lost >= 5 
              ? 'find_supplier' 
              : 'review_pricing') as 'review_pricing' | 'find_supplier' | 'discontinue'
        }))
        .sort((a, b) => b.lost_revenue - a.lost_revenue)
        .slice(0, limit);

      return results;
    },
  });
}

export function useFavorablePriceProducts(limit: number = 20) {
  return useQuery({
    queryKey: ['actionable-pricing', 'favorable-products', limit],
    queryFn: async (): Promise<FavorablePriceProduct[]> => {
      // Get all negotiations
      const { data: negotiations, error } = await supabase
        .from('quotation_item_negotiations')
        .select(`
          id,
          product_id,
          product_name,
          initial_quoted_rate,
          outcome
        `)
        .not('product_id', 'is', null)
        .in('outcome', ['won', 'lost']);

      if (error) throw error;

      // Aggregate by product
      const productStats = new Map<string, {
        product_name: string;
        won: number;
        lost: number;
        revenue: number;
      }>();

      negotiations?.forEach((neg: any) => {
        const productId = neg.product_id;
        
        if (!productStats.has(productId)) {
          productStats.set(productId, {
            product_name: neg.product_name || 'Unknown Product',
            won: 0,
            lost: 0,
            revenue: 0
          });
        }

        const data = productStats.get(productId)!;
        if (neg.outcome === 'won') {
          data.won++;
          data.revenue += neg.initial_quoted_rate || 0;
        } else {
          data.lost++;
        }
      });

      // Filter for high win rate products
      const results: FavorablePriceProduct[] = Array.from(productStats.entries())
        .filter(([_, data]) => (data.won + data.lost) >= 2) // At least 2 outcomes
        .map(([product_id, data]) => {
          const total = data.won + data.lost;
          const winRate = (data.won / total) * 100;
          
          return {
            product_id,
            product_name: data.product_name,
            win_rate: winRate,
            times_won: data.won,
            times_quoted: total,
            total_revenue: data.revenue,
            recommendation: (winRate >= 80 
              ? 'premium_product' 
              : winRate >= 50 
                ? 'stock_more' 
                : 'upsell') as 'premium_product' | 'stock_more' | 'upsell'
          };
        })
        .filter(p => p.win_rate >= 50) // Only favorable products
        .sort((a, b) => b.win_rate - a.win_rate)
        .slice(0, limit);

      return results;
    },
  });
}

export function useCustomerPriceSensitivity(limit: number = 20) {
  return useQuery({
    queryKey: ['actionable-pricing', 'customer-sensitivity', limit],
    queryFn: async (): Promise<CustomerPriceSensitivity[]> => {
      // Get leads with outcomes
      const { data: leads, error } = await supabase
        .from('leads')
        .select(`
          id,
          status,
          lost_reason,
          estimated_value,
          updated_at,
          customer:customers (
            id,
            company_name
          )
        `)
        .in('status', ['won', 'lost', 'quoted'])
        .not('customer_id', 'is', null);

      if (error) throw error;

      // Aggregate by customer
      const customerStats = new Map<string, {
        company_name: string;
        total_quotes: number;
        lost_to_price: number;
        total_potential: number;
        last_quote_date: string | null;
      }>();

      leads?.forEach((lead: any) => {
        const customerId = lead.customer?.id;
        if (!customerId) return;
        
        const isPriceLoss = lead.status === 'lost' && (
          lead.lost_reason?.toLowerCase().includes('price') ||
          lead.lost_reason === 'price_too_high' ||
          lead.lost_reason === 'better_price_elsewhere'
        );
        
        if (!customerStats.has(customerId)) {
          customerStats.set(customerId, {
            company_name: lead.customer.company_name || 'Unknown',
            total_quotes: 0,
            lost_to_price: 0,
            total_potential: 0,
            last_quote_date: null
          });
        }

        const data = customerStats.get(customerId)!;
        data.total_quotes++;
        data.total_potential += lead.estimated_value || 0;
        
        if (isPriceLoss) {
          data.lost_to_price++;
        }

        if (!data.last_quote_date || lead.updated_at > data.last_quote_date) {
          data.last_quote_date = lead.updated_at;
        }
      });

      // Calculate sensitivity and filter
      const results: CustomerPriceSensitivity[] = Array.from(customerStats.entries())
        .filter(([_, data]) => data.total_quotes >= 2 && data.lost_to_price > 0)
        .map(([customer_id, data]) => {
          const sensitivityScore = Math.min(100, (data.lost_to_price / data.total_quotes) * 100);
          
          return {
            customer_id,
            company_name: data.company_name,
            total_quotes_received: data.total_quotes,
            quotes_lost_to_price: data.lost_to_price,
            price_sensitivity_score: sensitivityScore,
            total_potential_revenue: data.total_potential,
            last_quote_date: data.last_quote_date,
            recommendation: (sensitivityScore >= 50 
              ? 'offer_discount' 
              : sensitivityScore >= 25 
                ? 'focus_value' 
                : 'deprioritize') as 'offer_discount' | 'focus_value' | 'deprioritize'
          };
        })
        .sort((a, b) => b.total_potential_revenue - a.total_potential_revenue)
        .slice(0, limit);

      return results;
    },
  });
}

export function usePricingHealthMetrics() {
  return useQuery({
    queryKey: ['actionable-pricing', 'health-metrics'],
    queryFn: async (): Promise<PricingHealthMetrics> => {
      // Get negotiation summary
      const { data: negotiations, error } = await supabase
        .from('quotation_item_negotiations')
        .select(`
          id,
          outcome,
          initial_quoted_rate,
          lead:leads (
            lost_reason,
            estimated_value
          )
        `)
        .in('outcome', ['won', 'lost']);

      if (error) throw error;

      let totalWon = 0;
      let totalLost = 0;
      let lostToPrice = 0;
      let revenueWon = 0;
      let revenueLostToPrice = 0;

      negotiations?.forEach((neg: any) => {
        const value = neg.initial_quoted_rate || neg.lead?.estimated_value || 0;
        
        if (neg.outcome === 'won') {
          totalWon++;
          revenueWon += value;
        } else if (neg.outcome === 'lost') {
          totalLost++;
          
          const lostReason = neg.lead?.lost_reason || '';
          const isPriceLoss = lostReason.toLowerCase().includes('price') ||
                             lostReason === 'price_too_high' ||
                             lostReason === 'better_price_elsewhere';
          
          if (isPriceLoss) {
            lostToPrice++;
            revenueLostToPrice += value;
          }
        }
      });

      const total = totalWon + totalLost;

      return {
        total_quotes_analyzed: total,
        total_won: totalWon,
        total_lost: totalLost,
        lost_to_price: lostToPrice,
        overall_win_rate: total > 0 ? (totalWon / total) * 100 : 0,
        price_related_loss_rate: totalLost > 0 ? (lostToPrice / totalLost) * 100 : 0,
        total_revenue_won: revenueWon,
        total_revenue_lost_to_price: revenueLostToPrice
      };
    },
  });
}

export function useDataQualityStatus() {
  return useQuery({
    queryKey: ['actionable-pricing', 'data-quality'],
    queryFn: async (): Promise<DataQualityStatus> => {
      const issues: string[] = [];

      // Count leads with outcomes
      const { count: leadsWithOutcomes } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .in('status', ['won', 'lost']);

      // Count leads with lost reasons
      const { count: leadsWithReasons } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'lost')
        .not('lost_reason', 'is', null);

      // Count quotations
      const { count: quotationsCount } = await supabase
        .from('quotations')
        .select('*', { count: 'exact', head: true });

      // Count negotiations
      const { count: negotiationsCount } = await supabase
        .from('quotation_item_negotiations')
        .select('*', { count: 'exact', head: true });

      // Count products quoted
      const { count: productsQuoted } = await supabase
        .from('quotation_item_negotiations')
        .select('product_id', { count: 'exact', head: true })
        .not('product_id', 'is', null);

      const leads = leadsWithOutcomes || 0;
      const reasons = leadsWithReasons || 0;
      const quotes = quotationsCount || 0;
      const negotiations = negotiationsCount || 0;
      const products = productsQuoted || 0;

      // Check for issues
      if (leads < 10) issues.push('Less than 10 leads with outcomes');
      if (reasons < leads * 0.5) issues.push('Many lost leads missing loss reasons');
      if (quotes < 20) issues.push('Less than 20 quotations created');
      if (negotiations < 10) issues.push('Less than 10 negotiation records');

      return {
        has_sufficient_data: leads >= 10 && negotiations >= 10,
        leads_with_outcomes: leads,
        leads_with_lost_reasons: reasons,
        quotations_count: quotes,
        negotiation_records: negotiations,
        products_quoted: products,
        data_issues: issues
      };
    },
  });
}

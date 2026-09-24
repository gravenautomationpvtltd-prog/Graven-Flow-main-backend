import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductMargin {
  productId: string;
  productName: string;
  hsnCode: string | null;
  category: string | null;
  sellingRate: number;
  purchasePrice: number;
  marginAmount: number;
  marginPercent: number;
  quantitySold: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

export interface CategoryMargin {
  category: string;
  productCount: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMarginPercent: number;
}

export interface MonthlyMargin {
  month: string;
  monthLabel: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
}

export interface ProfitStats {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  avgMarginPercent: number;
  productsWithMargin: number;
  totalProducts: number;
}

export function useProfitAnalytics(dateRange: { from: Date | null; to: Date | null }) {
  return useQuery({
    queryKey: ['profit-analytics', dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    queryFn: async () => {
      // Fetch all products with purchase price
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, hsn_code, category, default_rate, purchase_price')
        .eq('is_active', true);
      
      if (productsError) throw productsError;

      // Fetch quotation items with date filter
      let quotationItemsQuery = supabase
        .from('quotation_items')
        .select(`
          id,
          product_id,
          description,
          quantity,
          rate,
          amount,
          quotation:quotations!inner(id, created_at, status)
        `);

      if (dateRange.from) {
        quotationItemsQuery = quotationItemsQuery.gte('quotation.created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        quotationItemsQuery = quotationItemsQuery.lte('quotation.created_at', dateRange.to.toISOString());
      }

      const { data: quotationItems, error: itemsError } = await quotationItemsQuery;
      if (itemsError) throw itemsError;

      // Build product margin data
      const productMap = new Map<string, ProductMargin>();
      const productsById = new Map(products?.map(p => [p.id, p]) || []);

      quotationItems?.forEach((item: any) => {
        const product = item.product_id ? productsById.get(item.product_id) : null;
        const purchasePrice = product?.purchase_price;
        
        if (!purchasePrice || purchasePrice <= 0) return;

        const key = item.product_id || item.description;
        const existing = productMap.get(key);
        
        const revenue = Number(item.amount) || 0;
        const cost = purchasePrice * Number(item.quantity);
        const profit = revenue - cost;

        if (existing) {
          existing.quantitySold += Number(item.quantity);
          existing.totalRevenue += revenue;
          existing.totalCost += cost;
          existing.totalProfit += profit;
          existing.marginPercent = existing.totalCost > 0 
            ? (existing.totalProfit / existing.totalCost) * 100 
            : 0;
        } else {
          productMap.set(key, {
            productId: item.product_id || key,
            productName: product?.name || item.description,
            hsnCode: product?.hsn_code || null,
            category: product?.category || null,
            sellingRate: Number(item.rate),
            purchasePrice: purchasePrice,
            marginAmount: Number(item.rate) - purchasePrice,
            marginPercent: purchasePrice > 0 ? ((Number(item.rate) - purchasePrice) / purchasePrice) * 100 : 0,
            quantitySold: Number(item.quantity),
            totalRevenue: revenue,
            totalCost: cost,
            totalProfit: profit,
          });
        }
      });

      const productMargins = Array.from(productMap.values());

      // Calculate overall stats
      const totalRevenue = productMargins.reduce((sum, p) => sum + p.totalRevenue, 0);
      const totalCost = productMargins.reduce((sum, p) => sum + p.totalCost, 0);
      const grossProfit = totalRevenue - totalCost;
      const avgMarginPercent = totalCost > 0 ? (grossProfit / totalCost) * 100 : 0;
      const productsWithMargin = products?.filter(p => p.purchase_price && p.purchase_price > 0).length || 0;

      const stats: ProfitStats = {
        totalRevenue,
        totalCost,
        grossProfit,
        avgMarginPercent,
        productsWithMargin,
        totalProducts: products?.length || 0,
      };

      // Calculate category margins
      const categoryMap = new Map<string, CategoryMargin>();
      productMargins.forEach(pm => {
        const cat = pm.category || 'Uncategorized';
        const existing = categoryMap.get(cat);
        if (existing) {
          existing.productCount += 1;
          existing.totalRevenue += pm.totalRevenue;
          existing.totalCost += pm.totalCost;
          existing.totalProfit += pm.totalProfit;
          existing.avgMarginPercent = existing.totalCost > 0 
            ? (existing.totalProfit / existing.totalCost) * 100 
            : 0;
        } else {
          categoryMap.set(cat, {
            category: cat,
            productCount: 1,
            totalRevenue: pm.totalRevenue,
            totalCost: pm.totalCost,
            totalProfit: pm.totalProfit,
            avgMarginPercent: pm.totalCost > 0 ? (pm.totalProfit / pm.totalCost) * 100 : 0,
          });
        }
      });

      const categoryMargins = Array.from(categoryMap.values());

      // Calculate monthly margins
      const monthlyMap = new Map<string, MonthlyMargin>();
      quotationItems?.forEach((item: any) => {
        const product = item.product_id ? productsById.get(item.product_id) : null;
        const purchasePrice = product?.purchase_price;
        if (!purchasePrice || purchasePrice <= 0) return;

        const date = new Date(item.quotation.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        const revenue = Number(item.amount) || 0;
        const cost = purchasePrice * Number(item.quantity);
        const profit = revenue - cost;

        const existing = monthlyMap.get(monthKey);
        if (existing) {
          existing.revenue += revenue;
          existing.cost += cost;
          existing.profit += profit;
          existing.marginPercent = existing.cost > 0 ? (existing.profit / existing.cost) * 100 : 0;
        } else {
          monthlyMap.set(monthKey, {
            month: monthKey,
            monthLabel,
            revenue,
            cost,
            profit,
            marginPercent: cost > 0 ? (profit / cost) * 100 : 0,
          });
        }
      });

      const monthlyMargins = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));

      return {
        stats,
        productMargins,
        categoryMargins,
        monthlyMargins,
      };
    },
  });
}

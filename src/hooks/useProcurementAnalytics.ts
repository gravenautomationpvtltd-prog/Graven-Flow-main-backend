import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

interface POTrend {
  month: string;
  count: number;
  amount: number;
}

interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  totalPOs: number;
  totalAmount: number;
  avgRating: number;
  deliveryRating: number;
  qualityRating: number;
  priceRating: number;
}

interface SpendingByCategory {
  category: string;
  amount: number;
  count: number;
}

interface ProcurementStats {
  totalPOs: number;
  totalSpend: number;
  avgPOValue: number;
  pendingPOs: number;
  approvedPOs: number;
  rejectedPOs: number;
  avgDeliveryDays: number;
  suppliersUsed: number;
}

export function useProcurementAnalytics(months: number = 6) {
  return useQuery({
    queryKey: ['procurement-analytics', months],
    queryFn: async () => {
      const startDate = subMonths(new Date(), months);
      
      // Fetch purchase orders with supplier info
      const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          status,
          grand_total,
          created_at,
          order_date,
          expected_delivery,
          approved_at,
          supplier_id,
          suppliers (
            id,
            name,
            category
          )
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (poError) throw poError;

      // Fetch supplier ratings
      const { data: ratings, error: ratingsError } = await supabase
        .from('supplier_ratings')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (ratingsError) throw ratingsError;

      // Calculate PO trends by month
      const poTrends: POTrend[] = [];
      for (let i = months - 1; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        
        const monthPOs = purchaseOrders?.filter(po => {
          const poDate = new Date(po.created_at);
          return poDate >= monthStart && poDate <= monthEnd;
        }) || [];

        poTrends.push({
          month: format(monthDate, 'MMM yyyy'),
          count: monthPOs.length,
          amount: monthPOs.reduce((sum, po) => sum + (po.grand_total || 0), 0),
        });
      }

      // Calculate supplier performance
      const supplierMap = new Map<string, SupplierPerformance>();
      
      purchaseOrders?.forEach(po => {
        if (!po.supplier_id || !po.suppliers) return;
        
        const existing = supplierMap.get(po.supplier_id) || {
          supplierId: po.supplier_id,
          supplierName: po.suppliers.name,
          totalPOs: 0,
          totalAmount: 0,
          avgRating: 0,
          deliveryRating: 0,
          qualityRating: 0,
          priceRating: 0,
        };
        
        existing.totalPOs++;
        existing.totalAmount += po.grand_total || 0;
        supplierMap.set(po.supplier_id, existing);
      });

      // Add ratings to supplier performance
      const supplierRatingsMap = new Map<string, { delivery: number[], quality: number[], price: number[], overall: number[] }>();
      
      ratings?.forEach(rating => {
        const existing = supplierRatingsMap.get(rating.supplier_id) || { delivery: [], quality: [], price: [], overall: [] };
        if (rating.delivery_rating) existing.delivery.push(rating.delivery_rating);
        if (rating.quality_rating) existing.quality.push(rating.quality_rating);
        if (rating.price_rating) existing.price.push(rating.price_rating);
        if (rating.overall_rating) existing.overall.push(rating.overall_rating);
        supplierRatingsMap.set(rating.supplier_id, existing);
      });

      supplierRatingsMap.forEach((ratingsData, supplierId) => {
        const supplier = supplierMap.get(supplierId);
        if (supplier) {
          supplier.deliveryRating = ratingsData.delivery.length > 0 
            ? ratingsData.delivery.reduce((a, b) => a + b, 0) / ratingsData.delivery.length 
            : 0;
          supplier.qualityRating = ratingsData.quality.length > 0 
            ? ratingsData.quality.reduce((a, b) => a + b, 0) / ratingsData.quality.length 
            : 0;
          supplier.priceRating = ratingsData.price.length > 0 
            ? ratingsData.price.reduce((a, b) => a + b, 0) / ratingsData.price.length 
            : 0;
          supplier.avgRating = ratingsData.overall.length > 0 
            ? ratingsData.overall.reduce((a, b) => a + b, 0) / ratingsData.overall.length 
            : 0;
        }
      });

      const supplierPerformance = Array.from(supplierMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10);

      // Calculate spending by category
      const categoryMap = new Map<string, { amount: number; count: number }>();
      
      purchaseOrders?.forEach(po => {
        const category = po.suppliers?.category || 'Uncategorized';
        const existing = categoryMap.get(category) || { amount: 0, count: 0 };
        existing.amount += po.grand_total || 0;
        existing.count++;
        categoryMap.set(category, existing);
      });

      const spendingByCategory: SpendingByCategory[] = Array.from(categoryMap.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.amount - a.amount);

      // Calculate overall stats
      const approvedPOs = purchaseOrders?.filter(po => po.status === 'approved') || [];
      const stats: ProcurementStats = {
        totalPOs: purchaseOrders?.length || 0,
        totalSpend: purchaseOrders?.reduce((sum, po) => sum + (po.grand_total || 0), 0) || 0,
        avgPOValue: purchaseOrders?.length 
          ? (purchaseOrders.reduce((sum, po) => sum + (po.grand_total || 0), 0) / purchaseOrders.length)
          : 0,
        pendingPOs: purchaseOrders?.filter(po => ['draft', 'pending_verification', 'pending_authorization', 'pending_approval'].includes(po.status)).length || 0,
        approvedPOs: approvedPOs.length,
        rejectedPOs: purchaseOrders?.filter(po => po.status === 'rejected').length || 0,
        avgDeliveryDays: 0, // Would need GRN data for accurate calculation
        suppliersUsed: supplierMap.size,
      };

      return {
        stats,
        poTrends,
        supplierPerformance,
        spendingByCategory,
      };
    },
  });
}

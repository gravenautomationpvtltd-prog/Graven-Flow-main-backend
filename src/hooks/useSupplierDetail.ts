import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SupplierWithDetails {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst_number: string | null;
  pan_number: string | null;
  payment_terms: string | null;
  is_active: boolean;
  status: string | null;
  category: string | null;
  website: string | null;
  is_authorized_dealer: boolean | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  preferred_currency: string | null;
  created_at: string;
  updated_at: string;
}

export function useSupplierDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as SupplierWithDetails;
    },
    enabled: !!id,
  });
}

export function useSupplierPurchaseOrders(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-pos', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          created_by_profile:profiles!purchase_orders_created_by_fkey(full_name)
        `)
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supplierId,
  });
}

export function useSupplierGRNs(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-grns', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase
        .from('goods_receipt_notes')
        .select(`
          *,
          po:purchase_orders(po_number),
          received_by_profile:profiles!goods_receipt_notes_received_by_fkey(full_name)
        `)
        .eq('supplier_id', supplierId)
        .order('received_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supplierId,
  });
}

export function useSupplierPayments(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-payments', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase
        .from('supplier_payments')
        .select(`
          *,
          po:purchase_orders(po_number),
          paid_by_profile:profiles!supplier_payments_paid_by_fkey(full_name)
        `)
        .eq('supplier_id', supplierId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supplierId,
  });
}

export function useSupplierRatings(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-ratings', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase
        .from('supplier_ratings')
        .select(`
          *,
          po:purchase_orders(po_number),
          grn:goods_receipt_notes(grn_number),
          rated_by_profile:profiles!supplier_ratings_rated_by_fkey(full_name)
        `)
        .eq('supplier_id', supplierId)
        .order('rated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supplierId,
  });
}

export function useSupplierStats(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-stats', supplierId],
    queryFn: async () => {
      if (!supplierId) return null;
      
      // Fetch all data in parallel
      const [posResult, grnsResult, paymentsResult, ratingsResult] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('id, grand_total, status')
          .eq('supplier_id', supplierId),
        supabase
          .from('goods_receipt_notes')
          .select('id')
          .eq('supplier_id', supplierId),
        supabase
          .from('supplier_payments')
          .select('amount')
          .eq('supplier_id', supplierId),
        supabase
          .from('supplier_ratings')
          .select('overall_rating, quality_rating, delivery_rating, price_rating')
          .eq('supplier_id', supplierId),
      ]);

      const pos = posResult.data || [];
      const grns = grnsResult.data || [];
      const payments = paymentsResult.data || [];
      const ratings = ratingsResult.data || [];

      const totalPOValue = pos.reduce((sum, po) => sum + (po.grand_total || 0), 0);
      const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const outstandingAmount = totalPOValue - totalPayments;
      
      // Calculate average ratings
      let avgOverall = 0;
      let avgQuality = 0;
      let avgDelivery = 0;
      let avgPrice = 0;
      
      if (ratings.length > 0) {
        avgOverall = ratings.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / ratings.length;
        avgQuality = ratings.reduce((sum, r) => sum + (r.quality_rating || 0), 0) / ratings.length;
        avgDelivery = ratings.reduce((sum, r) => sum + (r.delivery_rating || 0), 0) / ratings.length;
        avgPrice = ratings.reduce((sum, r) => sum + (r.price_rating || 0), 0) / ratings.length;
      }

      return {
        totalPOs: pos.length,
        totalPOValue,
        totalGRNs: grns.length,
        totalPayments,
        outstandingAmount,
        totalRatings: ratings.length,
        avgOverall: Number(avgOverall.toFixed(1)),
        avgQuality: Number(avgQuality.toFixed(1)),
        avgDelivery: Number(avgDelivery.toFixed(1)),
        avgPrice: Number(avgPrice.toFixed(1)),
      };
    },
    enabled: !!supplierId,
  });
}

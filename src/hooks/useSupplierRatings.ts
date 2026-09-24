import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SupplierRating {
  id: string;
  supplier_id: string;
  po_id: string | null;
  grn_id: string | null;
  quality_rating: number | null;
  delivery_rating: number | null;
  price_rating: number | null;
  overall_rating: number | null;
  comments: string | null;
  rated_by: string | null;
  rated_at: string;
  created_at: string;
  rater?: {
    id: string;
    full_name: string;
  };
  purchase_order?: {
    id: string;
    po_number: string;
  };
}

export function useSupplierRatings(supplierId?: string) {
  return useQuery({
    queryKey: ['supplier-ratings', supplierId],
    queryFn: async () => {
      let query = supabase
        .from('supplier_ratings')
        .select(`
          *,
          rater:profiles!supplier_ratings_rated_by_fkey(id, full_name),
          purchase_order:purchase_orders(id, po_number)
        `)
        .order('rated_at', { ascending: false });

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SupplierRating[];
    },
  });
}

export function useSupplierAverageRating(supplierId: string | undefined) {
  return useQuery({
    queryKey: ['supplier-ratings', 'average', supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_ratings')
        .select('quality_rating, delivery_rating, price_rating, overall_rating')
        .eq('supplier_id', supplierId!);

      if (error) throw error;

      if (!data || data.length === 0) {
        return null;
      }

      const avgQuality = data.reduce((sum, r) => sum + (r.quality_rating || 0), 0) / data.length;
      const avgDelivery = data.reduce((sum, r) => sum + (r.delivery_rating || 0), 0) / data.length;
      const avgPrice = data.reduce((sum, r) => sum + (r.price_rating || 0), 0) / data.length;
      const avgOverall = data.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / data.length;

      return {
        quality: avgQuality,
        delivery: avgDelivery,
        price: avgPrice,
        overall: avgOverall,
        count: data.length,
      };
    },
  });
}

interface CreateRatingData {
  supplier_id: string;
  po_id?: string | null;
  grn_id?: string | null;
  quality_rating: number;
  delivery_rating: number;
  price_rating: number;
  comments?: string;
}

export function useCreateSupplierRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRatingData) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data: rating, error } = await supabase
        .from('supplier_ratings')
        .insert({
          ...data,
          rated_by: userId,
          rated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return rating;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-ratings'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Rating submitted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to submit rating: ' + error.message);
    },
  });
}

export function useUpdateSupplierRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateRatingData>) => {
      const { data: rating, error } = await supabase
        .from('supplier_ratings')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return rating;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-ratings'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Rating updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update rating: ' + error.message);
    },
  });
}

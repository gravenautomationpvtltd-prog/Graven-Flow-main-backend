import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PriceVersion {
  id: string;
  effective_date: string;
  old_list_price: number | null;
  new_list_price: number | null;
  old_sales_discount_pct: number | null;
  new_sales_discount_pct: number | null;
  old_purchase_discount_pct: number | null;
  new_purchase_discount_pct: number | null;
  old_sales_price: number | null;
  new_sales_price: number | null;
  old_purchase_price: number | null;
  new_purchase_price: number | null;
  source_label: string | null;
  created_at: string;
}

export function useProductDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['product-detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useProductPriceVersions(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-price-versions', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_price_versions')
        .select('*')
        .eq('product_id', productId!)
        .order('effective_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as PriceVersion[];
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface RFQItemSpec {
  brand?: string;
  model_number?: string;
  voltage?: string;
  current?: string;
  kw_rating?: string;
  protocol?: string;
  ip_rating?: string;
  mounting_type?: string;
  compliance_standards?: string;
  remarks?: string;
}

export interface RFQItemFormData {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  target_price: number | null;
  product_id?: string | null;
  specifications: RFQItemSpec;
  sort_order: number;
}

export function useRFQItems(rfqId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['rfq-items', rfqId],
    queryFn: async () => {
      if (!rfqId) return [];
      const { data, error } = await supabase
        .from('rfq_items')
        .select('*')
        .eq('rfq_id', rfqId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!rfqId,
  });

  const bulkUpsertMutation = useMutation({
    mutationFn: async ({ rfqId: rId, items: formItems }: { rfqId: string; items: RFQItemFormData[] }) => {
      await supabase.from('rfq_items').delete().eq('rfq_id', rId);
      if (formItems.length === 0) return;

      const rows = formItems.map((item, idx) => ({
        rfq_id: rId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || 'Nos',
        target_price: item.target_price,
        product_id: item.product_id || null,
        specifications: item.specifications as unknown as Json,
        sort_order: idx + 1,
      }));

      const { error } = await supabase.from('rfq_items').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfq-items'] });
    },
    onError: () => {
      toast.error('Failed to save RFQ items');
    },
  });

  return { items, isLoading, bulkUpsertMutation };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CCTStageName =
  | 'assigned'
  | 'in_sourcing'
  | 'price_finalized'
  | 'order_placed'
  | 'in_transit'
  | 'delivered';

export const STAGE_ORDER: CCTStageName[] = [
  'assigned',
  'in_sourcing',
  'price_finalized',
  'order_placed',
  'in_transit',
  'delivered',
];

export const STAGE_LABEL: Record<CCTStageName, string> = {
  assigned: 'Assigned',
  in_sourcing: 'In Sourcing',
  price_finalized: 'Price Finalized',
  order_placed: 'Order Placed',
  in_transit: 'In Transit',
  delivered: 'Delivered',
};

export interface CCTStage {
  id: string;
  decision_id: string;
  stage: CCTStageName;
  supplier_name: string | null;
  final_price: number | null;
  lead_time_days: number | null;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
}

export function useCCTStages(decisionId?: string) {
  return useQuery({
    queryKey: ['cct-stages', decisionId],
    queryFn: async () => {
      if (!decisionId) return [];
      const { data, error } = await (supabase as any)
        .from('cct_order_stages')
        .select('*')
        .eq('decision_id', decisionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as CCTStage[];
    },
    enabled: !!decisionId,
  });
}

export function useAllCCTStages() {
  return useQuery({
    queryKey: ['cct-stages', 'all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('cct_order_stages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CCTStage[];
    },
  });
}

export function useAddCCTStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<CCTStage, 'id' | 'created_at' | 'updated_by'> & { tenant_id?: string | null }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { data, error } = await (supabase as any)
        .from('cct_order_stages')
        .insert({ ...payload, updated_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cct-stages'] });
      qc.invalidateQueries({ queryKey: ['cct-decisions'] });
      toast.success('Stage updated');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update stage'),
  });
}

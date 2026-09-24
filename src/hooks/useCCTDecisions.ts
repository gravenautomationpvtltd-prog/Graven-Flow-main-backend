import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type SourcingType = 'domestic' | 'import' | 'hybrid';
export type AssignedTeam = 'domestic_procurement' | 'import_procurement';
export type CCTPriority = 'low' | 'normal' | 'high' | 'urgent';
export type CCTDecisionStatus = 'pending' | 'decided' | 'handed_off';

export interface CCTDecision {
  id: string;
  tenant_id: string | null;
  sales_order_id: string | null;
  order_item_id: string | null;
  lead_id: string | null;
  product_description: string | null;
  brand: string | null;
  quantity: number | null;
  selling_price: number | null;
  sourcing_type: SourcingType;
  target_price: number | null;
  assigned_team: AssignedTeam | null;
  assigned_to: string | null;
  priority: CCTPriority;
  timeline_date: string | null;
  decided_by: string | null;
  decided_at: string | null;
  locked: boolean;
  status: CCTDecisionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sales_orders?: {
    order_number: string;
    customer_id: string | null;
    order_value: number | null;
    customers?: { company_name: string } | null;
  } | null;
}

export function useCCTDecisions(filters?: { status?: CCTDecisionStatus | 'all' }) {
  return useQuery({
    queryKey: ['cct-decisions', filters],
    queryFn: async () => {
      let q = (supabase as any)
        .from('cct_sourcing_decisions')
        .select(`
          *,
          sales_orders:sales_order_id (
            order_number,
            customer_id,
            order_value,
            customers:customer_id ( company_name )
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        q = q.eq('status', filters.status);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CCTDecision[];
    },
  });
}

export function useUpdateCCTDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CCTDecision> & { id: string }) => {
      const { id, ...rest } = payload;
      const { data, error } = await (supabase as any)
        .from('cct_sourcing_decisions')
        .update({ ...rest, decided_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cct-decisions'] });
      qc.invalidateQueries({ queryKey: ['cct-stages'] });
      toast.success('Decision updated');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update decision'),
  });
}

export function useHandoffCCTDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { data, error } = await (supabase as any)
        .from('cct_sourcing_decisions')
        .update({
          status: 'handed_off',
          locked: true,
          decided_at: new Date().toISOString(),
          decided_by: user?.id,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cct-decisions'] });
      toast.success('Handed off to procurement');
    },
    onError: (e: any) => toast.error(e.message || 'Handoff failed'),
  });
}

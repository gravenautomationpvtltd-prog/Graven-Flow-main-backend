import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';

export interface RoutingSplit {
  office_id: string;
  percentage: number;
}

export interface LeadRoutingRule {
  id: string;
  tenant_id: string;
  rule_name: string;
  is_active: boolean;
  applies_to: 'new_customers' | 'all';
  source_filter: string[] | null;
  splits: RoutingSplit[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = 'lead_routing_splits' as any;

export function useLeadRoutingRules() {
  return useQuery({
    queryKey: ['lead-routing-rules'],
    queryFn: async (): Promise<LeadRoutingRule[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as LeadRoutingRule[];
    },
  });
}

export function useRoutingCounters(ruleId: string | undefined) {
  return useQuery({
    queryKey: ['lead-routing-counters', ruleId],
    enabled: !!ruleId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('lead_routing_counters')
        .select('*')
        .eq('rule_id', ruleId);
      if (error) throw error;
      return (data || []) as Array<{ office_id: string; assigned_count: number }>;
    },
  });
}

export function useSaveLeadRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      rule: Partial<LeadRoutingRule> & { splits: RoutingSplit[]; rule_name: string },
    ) => {
      await ensureFreshSession();
      const tenantId = await requireTenantId();
      const sum = rule.splits.reduce((s, r) => s + Number(r.percentage || 0), 0);
      if (Math.round(sum) !== 100) {
        throw new Error(`Percentages must sum to 100 (currently ${sum}).`);
      }
      const payload: any = {
        rule_name: rule.rule_name,
        is_active: rule.is_active ?? true,
        applies_to: rule.applies_to ?? 'new_customers',
        source_filter: rule.source_filter ?? null,
        splits: rule.splits,
        notes: rule.notes ?? null,
        tenant_id: tenantId,
      };
      if (rule.id) {
        const { error } = await (supabase as any).from(TABLE).update(payload).eq('id', rule.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from(TABLE).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-routing-rules'] });
      toast.success('Routing rule saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLeadRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-routing-rules'] });
      toast.success('Rule deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleLeadRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from(TABLE).update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-routing-rules'] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type CstChannel = 'call' | 'whatsapp' | 'email' | 'meeting' | 'note' | 'system';
export type CstOutcome =
  | 'connected' | 'no_answer' | 'not_interested' | 'interested'
  | 'order_promise' | 'do_not_contact' | 'info_shared' | 'other';

export interface CstEngagement {
  id: string;
  tenant_id: string;
  customer_id: string;
  user_id: string | null;
  channel: CstChannel;
  direction: 'in' | 'out';
  outcome: CstOutcome | null;
  summary: string | null;
  next_action_at: string | null;
  next_action_type: string | null;
  created_at: string;
  updated_at: string;
  user?: { full_name: string | null } | null;
}

export interface EngagementSummary {
  last_engagement_at: string | null;
  last_channel: CstChannel | null;
  last_outcome: CstOutcome | null;
  scheduled_callback_at: string | null;
  touches_30d: number;
  touches_90d: number;
}

const EMPTY_SUMMARY: EngagementSummary = {
  last_engagement_at: null,
  last_channel: null,
  last_outcome: null,
  scheduled_callback_at: null,
  touches_30d: 0,
  touches_90d: 0,
};

/** Fetch summaries for many customers at once (used by CustomerSuccess card grid). */
export async function fetchEngagementSummaries(customerIds: string[]): Promise<Map<string, EngagementSummary>> {
  const map = new Map<string, EngagementSummary>();
  if (!customerIds.length) return map;

  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  for (let i = 0; i < customerIds.length; i += 200) {
    const batch = customerIds.slice(i, i + 200);
    const { data, error } = await supabase
      .from('cst_engagements')
      .select('customer_id, channel, outcome, next_action_at, created_at')
      .in('customer_id', batch)
      .gte('created_at', cutoff90)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const now = Date.now();
    for (const row of data || []) {
      const cur = map.get(row.customer_id) || { ...EMPTY_SUMMARY };
      // First row per customer wins as "last" because ordered DESC
      if (!cur.last_engagement_at) {
        cur.last_engagement_at = row.created_at;
        cur.last_channel = row.channel as CstChannel;
        cur.last_outcome = row.outcome as CstOutcome | null;
      }
      const ageDays = (now - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays <= 30) cur.touches_30d += 1;
      cur.touches_90d += 1;
      if (row.next_action_at) {
        const na = row.next_action_at;
        if (!cur.scheduled_callback_at || new Date(na) < new Date(cur.scheduled_callback_at)) {
          cur.scheduled_callback_at = na;
        }
      }
      map.set(row.customer_id, cur);
    }
  }
  return map;
}

export function useCstEngagements(customerId: string | null) {
  return useQuery({
    queryKey: ['cst-engagements', customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<CstEngagement[]> => {
      const { data, error } = await supabase
        .from('cst_engagements')
        .select('*, user:profiles!user_id(full_name)')
        .eq('customer_id', customerId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as any) || [];
    },
  });
}

export function useLogEngagement() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      customer_id: string;
      channel: CstChannel;
      direction?: 'in' | 'out';
      outcome?: CstOutcome | null;
      summary?: string | null;
      next_action_at?: string | null;
      next_action_type?: string | null;
    }) => {
      if (!user?.id) throw new Error('Not signed in');

      // Resolve tenant from customer or profile
      let tenantId: string | null = (profile as any)?.tenant_id ?? null;
      if (!tenantId) {
        const { data } = await supabase
          .from('customers').select('tenant_id').eq('id', payload.customer_id).maybeSingle();
        tenantId = (data as any)?.tenant_id ?? null;
      }
      if (!tenantId) throw new Error('Missing tenant context');

      const { data, error } = await supabase
        .from('cst_engagements')
        .insert({
          tenant_id: tenantId,
          customer_id: payload.customer_id,
          user_id: user.id,
          channel: payload.channel,
          direction: payload.direction || 'out',
          outcome: payload.outcome ?? null,
          summary: payload.summary ?? null,
          next_action_at: payload.next_action_at ?? null,
          next_action_type: payload.next_action_type ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      toast.success('Touch logged');
      qc.invalidateQueries({ queryKey: ['cst-engagements', vars.customer_id] });
      qc.invalidateQueries({ queryKey: ['cst-customers'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to log touch'),
  });
}

export function useToggleCstFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { customer_id: string; field: 'cst_favourite' | 'cst_dnc'; value: boolean }) => {
      const { error } = await supabase
        .from('customers')
        .update({ [p.field]: p.value } as any)
        .eq('id', p.customer_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cst-customers'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Update failed'),
  });
}

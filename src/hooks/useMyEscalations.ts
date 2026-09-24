import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

type EscalationLevel = Database['public']['Enums']['escalation_level'];

export interface MyEscalation {
  id: string;
  escalation_level: EscalationLevel;
  escalated_from: EscalationLevel | null;
  reason: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  lead?: {
    id: string;
    title: string;
    status: string;
  } | null;
  task?: {
    id: string;
    title: string;
    status: string;
  } | null;
  resolved_by_user?: {
    id: string;
    full_name: string;
  } | null;
}

export function useMyEscalations(includeResolved = false) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-escalations', user?.id, includeResolved],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('escalation_logs')
        .select(`
          *,
          lead:leads(id, title, status),
          task:tasks(id, title, status),
          resolved_by_user:profiles!escalation_logs_resolved_by_fkey(id, full_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!includeResolved) {
        query = query.is('resolved_at', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as MyEscalation[];
    },
    enabled: !!user?.id,
  });
}

export function useMyEscalationStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-escalation-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, pending: 0, thisMonth: 0 };

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('escalation_logs')
        .select('id, resolved_at, created_at')
        .eq('user_id', user.id);

      if (error) throw error;

      const pending = data.filter(e => !e.resolved_at).length;
      const thisMonth = data.filter(e => new Date(e.created_at) >= startOfMonth).length;

      return {
        total: data.length,
        pending,
        thisMonth,
      };
    },
    enabled: !!user?.id,
  });
}

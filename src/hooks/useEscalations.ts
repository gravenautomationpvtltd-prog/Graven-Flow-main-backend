import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type EscalationLog = Database['public']['Tables']['escalation_logs']['Row'];
type EscalationLevel = Database['public']['Enums']['escalation_level'];

export interface EscalationWithDetails extends EscalationLog {
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
  lead?: {
    id: string;
    title: string;
    status: string;
  };
  task?: {
    id: string;
    title: string;
    status: string;
  };
  resolved_by_user?: {
    id: string;
    full_name: string;
  };
}

export interface EscalationFilters {
  level?: EscalationLevel;
  userId?: string;
  resolved?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export function useEscalations(filters: EscalationFilters = {}) {
  return useQuery({
    queryKey: ['escalations', filters],
    queryFn: async () => {
      let query = supabase
        .from('escalation_logs')
        .select(`
          *,
          user:profiles!escalation_logs_user_id_fkey(id, full_name, email),
          lead:leads(id, title, status),
          task:tasks(id, title, status),
          resolved_by_user:profiles!escalation_logs_resolved_by_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (filters.level) {
        query = query.eq('escalation_level', filters.level);
      }

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters.resolved === true) {
        query = query.not('resolved_at', 'is', null);
      } else if (filters.resolved === false) {
        query = query.is('resolved_at', null);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as EscalationWithDetails[];
    },
  });
}

export function useEscalationStats() {
  return useQuery({
    queryKey: ['escalation-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escalation_logs')
        .select('escalation_level, resolved_at');

      if (error) throw error;

      const stats = {
        total: data.length,
        pending: data.filter(e => !e.resolved_at).length,
        resolved: data.filter(e => e.resolved_at).length,
        byLevel: {
          alert: data.filter(e => e.escalation_level === 'alert' && !e.resolved_at).length,
          manager: data.filter(e => e.escalation_level === 'manager' && !e.resolved_at).length,
          coo: data.filter(e => e.escalation_level === 'coo' && !e.resolved_at).length,
          ceo: data.filter(e => e.escalation_level === 'ceo' && !e.resolved_at).length,
        },
      };

      return stats;
    },
  });
}

export function useResolveEscalation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      escalationId, 
      resolutionNotes 
    }: { 
      escalationId: string; 
      resolutionNotes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('escalation_logs')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_notes: resolutionNotes || null,
        })
        .eq('id', escalationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['escalation-stats'] });
    },
  });
}

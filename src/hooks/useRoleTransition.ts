import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface RoleWorkSummary {
  leads: number;
  customers: number;
  quotations: number;
  sales_orders: number;
  tasks: number;
  cro_assignments: number;
  unqualified_leads: number;
  subordinates: number;
  price_requests: number;
  purchase_orders: number;
  dispatches: number;
  escalations: number;
  reminders: number;
  total: number;
}

/**
 * Map a removed role to the set of roles that a delegate must hold to
 * inherit the work. Multiple removed roles → union of required role options.
 */
export const REQUIRED_DELEGATE_ROLES: Record<string, AppRole[]> = {
  sales: ['sales', 'manager'],
  cro: ['cro'],
  manager: ['manager', 'super_admin', 'coo'],
  procurement: ['procurement', 'procurement_manager'],
  procurement_manager: ['procurement_manager'],
  import_procurement: ['import_procurement', 'procurement_manager'],
  warehouse: ['warehouse'],
};

export function useRoleWorkSummary(userId: string | undefined, rolesRemoved: AppRole[]) {
  return useQuery({
    queryKey: ['role-work-summary', userId, [...rolesRemoved].sort()],
    queryFn: async () => {
      if (!userId || rolesRemoved.length === 0) {
        return null;
      }
      const { data, error } = await supabase.rpc('get_role_work_summary', {
        p_user_id: userId,
        p_roles_removed: rolesRemoved,
      });
      if (error) throw error;
      return data as unknown as RoleWorkSummary;
    },
    enabled: !!userId && rolesRemoved.length > 0,
  });
}

interface DelegateParams {
  fromUserId: string;
  toUserId: string;
  rolesRemoved: AppRole[];
  notes?: string;
}

export function useDelegateRoleWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fromUserId, toUserId, rolesRemoved, notes }: DelegateParams) => {
      const { data, error } = await supabase.rpc('delegate_role_work', {
        p_from_user_id: fromUserId,
        p_to_user_id: toUserId,
        p_roles_removed: rolesRemoved,
        p_notes: notes ?? null,
      });
      if (error) throw error;
      return data as unknown as Omit<RoleWorkSummary, 'total'>;
    },
    onSuccess: (counts) => {
      const parts = Object.entries(counts)
        .filter(([, n]) => (n as number) > 0)
        .map(([k, n]) => `${n} ${k.replace(/_/g, ' ')}`);
      toast.success(
        parts.length
          ? `Work reassigned: ${parts.join(', ')}`
          : 'No active work to reassign'
      );
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reassign work: ${error.message}`);
    },
  });
}

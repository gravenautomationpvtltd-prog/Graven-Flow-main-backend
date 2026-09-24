import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WorkSummary {
  activeLeads: number;
  pendingTasks: number;
  customers: number;
  subordinates: number;
}

export function useEmployeeWorkSummary(userId: string) {
  return useQuery({
    queryKey: ['employee-work-summary', userId],
    queryFn: async () => {
      const [leadsRes, tasksRes, customersRes, subordinatesRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', userId)
          .not('status', 'in', '("won","lost")'),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', userId)
          .not('status', 'in', '("completed","cancelled")'),
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_sales_id', userId),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('manager_id', userId)
          .eq('is_active', true)
          .neq('id', userId),
      ]);

      return {
        activeLeads: leadsRes.count || 0,
        pendingTasks: tasksRes.count || 0,
        customers: customersRes.count || 0,
        subordinates: subordinatesRes.count || 0,
      } as WorkSummary;
    },
    enabled: !!userId,
  });
}

interface ExitParams {
  fromUserId: string;
  toUserIds: string[];
  exitType: 'terminated' | 'resigned';
  exitDate: string;
  exitReason?: string;
}

export function useEmployeeExit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fromUserId, toUserIds, exitType, exitDate, exitReason }: ExitParams) => {
      // 1. Delegate work via multi-recipient RPC (round-robin split)
      const recipients = toUserIds.length > 0 ? toUserIds : [fromUserId]; // self = no-op when no work
      const { data: delegationResult, error: rpcError } = await supabase.rpc(
        'delegate_employee_work_multi' as any,
        {
          p_from_user_id: fromUserId,
          p_to_user_ids: recipients,
        }
      );

      if (rpcError) throw rpcError;

      // 2. Update the employee's profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_active: false,
          employment_status: exitType,
          exit_date: exitDate,
          exit_reason: exitReason || null,
        })
        .eq('id', fromUserId);

      if (updateError) throw updateError;

      return delegationResult;
    },
    onSuccess: (result) => {
      const r = (result || {}) as Record<string, number>;
      const recipients = r.recipient_count || 1;
      toast.success(
        `Employee offboarded. Split across ${recipients} delegate(s): ${r.leads_reassigned || 0} leads, ${r.tasks_reassigned || 0} tasks, ${r.customers_reassigned || 0} customers, ${r.subordinates_reassigned || 0} reports, ${r.quotations_reassigned || 0} quotations, ${r.sales_orders_reassigned || 0} sales orders.`
      );
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-with-details'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['employee-profile'] });
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to offboard employee: ${error.message}`);
    },
  });
}

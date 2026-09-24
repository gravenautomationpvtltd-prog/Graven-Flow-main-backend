import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UserBookCounts {
  leads: number;
  customers: number;
  escalations: number;
  tasks: number;
  quotations_authored: number;
  sales_orders_authored: number;
}

export interface ActiveSalesUser {
  id: string;
  full_name: string;
  email: string;
}

export type RecipientRole = 'sales' | 'cro';

/** All users in caller's tenant (source candidates) */
export function useAllTenantUsers() {
  return useQuery({
    queryKey: ['redistribute-source-users'],
    queryFn: async (): Promise<ActiveSalesUser[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return (data || []) as ActiveSalesUser[];
    },
  });
}

/** Roles held by a given user — used to default the recipient pool. */
export function useUserRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-roles-for-redistribute', userId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data || []).map((r: any) => r.role as string);
    },
    enabled: !!userId,
  });
}

/** Active recipients with the given role (sales or cro), in the caller's tenant. */
export function useActiveRecipients(role: RecipientRole, excludeUserId?: string) {
  return useQuery({
    queryKey: ['active-recipients', role, excludeUserId],
    queryFn: async (): Promise<ActiveSalesUser[]> => {
      const { data: roleRows, error: roleErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', role);
      if (roleErr) throw roleErr;
      const ids = [...new Set((roleRows || []).map((r: any) => r.user_id))].filter(
        (id) => id !== excludeUserId,
      );
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, is_active, employment_status, exit_date')
        .in('id', ids)
        .eq('is_active', true)
        .is('exit_date', null)
        .order('full_name');
      if (error) throw error;
      return ((data || []) as any[])
        .filter((p) => (p.employment_status ?? 'active') === 'active')
        .map((p) => ({ id: p.id, full_name: p.full_name, email: p.email }));
    },
    enabled: !!excludeUserId,
  });
}

/** @deprecated kept for backwards compatibility. */
export function useActiveSalesRecipients(excludeUserId?: string) {
  return useActiveRecipients('sales', excludeUserId);
}

export function usePreviewUserBook(userId: string | undefined) {
  return useQuery({
    queryKey: ['preview-user-book', userId],
    queryFn: async (): Promise<UserBookCounts> => {
      const { data, error } = await supabase.rpc('preview_user_book', { p_user_id: userId });
      if (error) throw error;
      return data as unknown as UserBookCounts;
    },
    enabled: !!userId,
  });
}

interface RedistributeParams {
  fromUserId: string;
  toUserIds: string[];
  entities: ('leads' | 'customers' | 'escalations' | 'tasks')[];
  includeQuotationAuthorship?: boolean;
  includeOrderAuthorship?: boolean;
  recipientRole?: RecipientRole;
}

export function useRedistributeWorkload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: RedistributeParams) => {
      const { data, error } = await supabase.rpc('redistribute_user_book', {
        p_from_user_id: params.fromUserId,
        p_to_user_ids: params.toUserIds,
        p_entities: params.entities,
        p_include_quotation_authorship: params.includeQuotationAuthorship ?? false,
        p_include_order_authorship: params.includeOrderAuthorship ?? false,
        p_recipient_role: params.recipientRole ?? 'sales',
      } as any);
      if (error) throw error;
      return data as {
        batch_id: string;
        leads: number;
        customers: number;
        escalations: number;
        tasks: number;
        quotations: number;
        sales_orders: number;
        recipient_count: number;
      };
    },
    onSuccess: (result) => {
      const moved =
        result.leads + result.customers + result.escalations + result.tasks +
        result.quotations + result.sales_orders;
      toast.success(`Redistributed ${moved} records across ${result.recipient_count} users`);
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['preview-user-book'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e: Error) => toast.error(`Redistribution failed: ${e.message}`),
  });
}

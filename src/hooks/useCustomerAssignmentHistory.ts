import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AssignmentRecord {
  id: string;
  customer_id: string;
  assigned_to: string | null;
  assigned_from: string;
  assigned_until: string | null;
  tenant_id: string | null;
  profile_name: string | null;
}

export function useCustomerAssignmentHistory(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-assignment-history', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_assignment_history')
        .select('*, profiles:assigned_to(full_name)')
        .eq('customer_id', customerId!)
        .order('assigned_from', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        customer_id: row.customer_id,
        assigned_to: row.assigned_to,
        assigned_from: row.assigned_from,
        assigned_until: row.assigned_until,
        tenant_id: row.tenant_id,
        profile_name: row.profiles?.full_name || null,
      })) as AssignmentRecord[];
    },
  });
}

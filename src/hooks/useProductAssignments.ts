import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';
import { toast } from 'sonner';

export type ProductTaskType = 'update_pricing' | 'add_details' | 'verify' | 'mark_legacy' | 'remove';
export type ProductAssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'blocked';

export const PRODUCT_TASK_TYPES: { value: ProductTaskType; label: string }[] = [
  { value: 'update_pricing', label: 'Update pricing' },
  { value: 'add_details', label: 'Add details' },
  { value: 'verify', label: 'Verify' },
  { value: 'mark_legacy', label: 'Mark discontinued / obsolete' },
  { value: 'remove', label: 'Remove' },
];

export const PRODUCT_ASSIGNMENT_STATUSES: ProductAssignmentStatus[] = [
  'assigned',
  'in_progress',
  'completed',
  'blocked',
];

export type ProductAssignmentRow = {
  id: string;
  product_id: string | null;
  task_type: ProductTaskType;
  status: ProductAssignmentStatus;
  priority: string;
  due_date: string | null;
  note: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
  product?: { id: string; name: string | null; model_number: string | null } | null;
};

export function useProductAssignments() {
  return useQuery({
    queryKey: ['product-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_assignments')
        .select('*, product:products(id, name, model_number)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProductAssignmentRow[];
    },
  });
}

export type AssignProductWorkInput = {
  productIds: string[];
  assignedTo: string;
  taskType: ProductTaskType;
  dueDate?: string | null;
  priority?: string;
  note?: string | null;
};

export function useAssignProductWork() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: AssignProductWorkInput) => {
      await ensureFreshSession();
      if (!user) throw new Error('Please sign in again.');
      if (!input.productIds.length) throw new Error('Select at least one product.');
      const tenantId = await requireTenantId();

      const payload = input.productIds.map((productId) => ({
        tenant_id: tenantId,
        product_id: productId,
        task_type: input.taskType,
        priority: input.priority ?? 'normal',
        due_date: input.dueDate || null,
        note: input.note || null,
        assigned_to: input.assignedTo,
        assigned_by: user.id,
        status: 'assigned' as const,
      }));

      const { data, error } = await supabase.from('product_assignments').insert(payload).select('id');
      if (error) throw error;

      const created = data ?? [];
      if (created.length) {
        await supabase.from('bie_work_history').insert(
          created.map((row) => ({
            work_type: 'product_assignments',
            record_id: row.id,
            to_status: 'assigned',
            note: 'Assigned',
            changed_by: user.id,
            tenant_id: tenantId,
          })),
        );
      }
      return created.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['product-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['bie-work'] });
      toast.success(`${count} product${count === 1 ? '' : 's'} assigned`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateProductAssignment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      values,
      previousStatus,
      note,
    }: {
      id: string;
      values: Record<string, string | null>;
      previousStatus?: string;
      note?: string;
    }) => {
      await ensureFreshSession();
      const { error } = await supabase.from('product_assignments').update(values).eq('id', id);
      if (error) throw error;

      const nextStatus = values.status ? String(values.status) : undefined;
      if (user && nextStatus && previousStatus && nextStatus !== previousStatus) {
        const tenantId = await requireTenantId();
        await supabase.from('bie_work_history').insert({
          work_type: 'product_assignments',
          record_id: id,
          from_status: previousStatus,
          to_status: nextStatus,
          note: note ?? null,
          changed_by: user.id,
          tenant_id: tenantId,
        });
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['bie-work'] });
      queryClient.invalidateQueries({ queryKey: ['bie-history', variables.id] });
      toast.success('Assignment updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteProductAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await ensureFreshSession();
      const { error } = await supabase.from('product_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['bie-work'] });
      toast.success('Assignment removed');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

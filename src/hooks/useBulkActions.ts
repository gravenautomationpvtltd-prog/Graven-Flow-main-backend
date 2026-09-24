import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity, EntityType } from '@/lib/activity-logger';

type TableName = 'leads' | 'sales_orders' | 'customers' | 'tasks' | 'invoices' | 'dispatches' | 'quotations' | 'purchase_orders' | 'products' | 'suppliers';

interface BulkUpdateParams {
  table: TableName;
  ids: string[];
  updates: Record<string, any>;
  entityType: EntityType;
}

interface BulkDeleteParams {
  table: TableName;
  ids: string[];
  entityType: EntityType;
}

interface BulkAssignParams {
  table: TableName;
  ids: string[];
  assignField: string;
  assignToId: string;
  entityType: EntityType;
}

export function useBulkUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ table, ids, updates, entityType }: BulkUpdateParams) => {
      const { error } = await supabase
        .from(table)
        .update(updates)
        .in('id', ids);

      if (error) throw error;

      // Log activity for each item
      for (const id of ids) {
        await logActivity({
          action: 'update',
          entityType,
          entityId: id,
          changes: { after: updates },
          metadata: { bulk: true, total_items: ids.length },
        });
      }

      return { count: ids.length };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.table] });
      toast.success(`${data.count} items updated`);
    },
    onError: (error: Error) => {
      toast.error('Bulk update failed: ' + error.message);
    },
  });
}

export function useBulkDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ table, ids, entityType }: BulkDeleteParams) => {
      const { error } = await supabase
        .from(table)
        .delete()
        .in('id', ids);

      if (error) throw error;

      // Log activity for each item
      for (const id of ids) {
        await logActivity({
          action: 'delete',
          entityType,
          entityId: id,
          metadata: { bulk: true, total_items: ids.length },
        });
      }

      return { count: ids.length };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.table] });
      toast.success(`${data.count} items deleted`);
    },
    onError: (error: Error) => {
      toast.error('Bulk delete failed: ' + error.message);
    },
  });
}

export function useBulkAssign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ table, ids, assignField, assignToId, entityType }: BulkAssignParams) => {
      const { error } = await supabase
        .from(table)
        .update({ [assignField]: assignToId })
        .in('id', ids);

      if (error) throw error;

      // Log activity for each item
      for (const id of ids) {
        await logActivity({
          action: 'update',
          entityType,
          entityId: id,
          changes: { after: { [assignField]: assignToId } },
          metadata: { bulk: true, action_type: 'assign', total_items: ids.length },
        });
      }

      return { count: ids.length };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.table] });
      toast.success(`${data.count} items assigned`);
    },
    onError: (error: Error) => {
      toast.error('Bulk assign failed: ' + error.message);
    },
  });
}

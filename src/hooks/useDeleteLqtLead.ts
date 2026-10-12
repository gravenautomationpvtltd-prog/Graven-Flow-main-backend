import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invalidateDashboardData } from '@/lib/dashboard-invalidation';
import { logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/hooks/useAuth';

export function useDeleteLqtLead() {
  const queryClient = useQueryClient();
  const { user, isAdmin, isManager, isCRO } = useAuth();

  // RBAC permissions: Admins, Managers, and CRO users (for assigned leads) can initiate deletion
  const canDeleteLead = (assignedTo?: string | null) => {
    if (isAdmin || isManager) return true;
    if (isCRO && assignedTo && user?.id === assignedTo) return true;
    return false;
  };

  const mutation = useMutation({
    mutationFn: async (leadId: string) => {
      if (!leadId) throw new Error('Missing lead ID for deletion');

      const { data, error } = await (supabase as any).rpc('delete_lqt_lead', {
        p_lead_id: leadId,
      });

      if (error) {
        throw new Error(error.message || 'Failed to delete lead from database');
      }

      return { leadId, data };
    },
    onSuccess: ({ leadId }) => {
      // Optimistically remove from all active LQT lead lists immediately (0ms delay)
      queryClient.setQueriesData({ queryKey: ['lqt-leads'] }, (old: any) => {
        if (Array.isArray(old)) {
          return old.filter((item) => item.id !== leadId);
        }
        return old;
      });

      // Invalidate all related caches immediately
      queryClient.invalidateQueries({ queryKey: ['lqt-leads'] });
      queryClient.invalidateQueries({ queryKey: ['lqt-stats'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['deleted-leads'] });
      invalidateDashboardData(queryClient);

      toast.success('Lead moved to trash');

      logActivity({
        action: 'delete',
        entityType: 'lead',
        entityId: leadId,
        metadata: { source: 'lqt_inbox_action' },
      });
    },
    onError: (error: Error) => {
      toast.error(`Deletion failed: ${error.message}`);
    },
  });

  return {
    deleteLead: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    canDeleteLead,
  };
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity-logger';

export function useEmptyAllTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('empty_all_trash');
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all trash-related queries
      queryClient.invalidateQueries({ queryKey: ['deleted-leads'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-customers'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Trash emptied successfully');
      logActivity({
        action: 'delete',
        entityType: 'lead',
        entityName: 'All Trash Items',
        metadata: { action: 'empty_all_trash' },
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to empty trash: ' + error.message);
    },
  });
}

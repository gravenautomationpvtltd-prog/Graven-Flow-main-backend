import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Activity = Database['public']['Tables']['activities']['Row'];
type ActivityInsert = Database['public']['Tables']['activities']['Insert'];

export interface ActivityWithUser extends Activity {
  user?: Database['public']['Tables']['profiles']['Row'] | null;
}

export function useActivities(leadId: string | undefined) {
  return useQuery({
    queryKey: ['activities', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          user:profiles!activities_user_id_fkey(*)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ActivityWithUser[];
    },
    enabled: !!leadId,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (activity: Omit<ActivityInsert, 'id' | 'created_at' | 'user_id'>) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('activities')
        .insert({
          ...activity,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Update lead's last_activity_at and first_response_at if this is first activity
      if (activity.lead_id) {
        const now = new Date().toISOString();
        
        // First, get the lead to check if first_response_at is null and to calculate response time
        const { data: lead } = await supabase
          .from('leads')
          .select('first_response_at, created_at')
          .eq('id', activity.lead_id)
          .single();

        const updates: Record<string, unknown> = { last_activity_at: now };

        // If this is the first response, calculate response time
        if (lead && !lead.first_response_at) {
          updates.first_response_at = now;
          const createdAt = new Date(lead.created_at).getTime();
          const responseAt = new Date(now).getTime();
          updates.first_response_minutes = Math.round((responseAt - createdAt) / (1000 * 60));
        }

        await supabase
          .from('leads')
          .update(updates)
          .eq('id', activity.lead_id);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activities', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['lead', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Activity logged');
    },
    onError: (error: Error) => {
      toast.error('Failed to log activity: ' + error.message);
    },
  });
}

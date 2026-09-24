import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TrackOutreachParams {
  customerId: string;
  channel: 'whatsapp' | 'email';
}

export function useTrackOutreach() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, channel }: TrackOutreachParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      // Check for existing record today for this customer
      const { data: existing } = await supabase
        .from('customer_outreach')
        .select('id')
        .eq('customer_id', customerId)
        .eq('campaign_date', today)
        .maybeSingle();

      const updateData = channel === 'whatsapp'
        ? { whatsapp_sent_at: now, sent_by_user_id: userId, status: 'sent' as const }
        : { email_sent_at: now, sent_by_user_id: userId, status: 'sent' as const };

      if (existing) {
        const { error } = await supabase
          .from('customer_outreach')
          .update({ ...updateData, updated_at: now })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customer_outreach')
          .insert({
            customer_id: customerId,
            campaign_date: today,
            ...updateData,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-outreach-history'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
    },
  });
}

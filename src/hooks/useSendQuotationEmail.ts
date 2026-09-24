import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface SendQuotationEmailParams {
  quotation_id: string;
  recipient_email: string;
  recipient_name?: string;
  message?: string;
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
  lead_id?: string; // For activity logging
  quotation_number?: string; // For activity logging
}

export function useSendQuotationEmail() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: SendQuotationEmailParams) => {
      const { data, error } = await supabase.functions.invoke('send-quotation-email', {
        body: {
          ...params,
          user_id: user?.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to send email');

      // AUTO-LOG ACTIVITY: Log email send as activity for escalation tracking
      if (params.lead_id && user?.id) {
        await supabase.from('activities').insert({
          lead_id: params.lead_id,
          user_id: user.id,
          activity_type: 'email',
          description: `Sent quotation ${params.quotation_number || params.quotation_id} via email to ${params.recipient_email}`,
          metadata: { 
            quotation_id: params.quotation_id, 
            recipient_email: params.recipient_email,
            action: 'quotation_sent_email'
          },
        });

        // Update lead's last_activity_at to prevent false escalation
        await supabase
          .from('leads')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', params.lead_id);
      }

      return { ...data, lead_id: params.lead_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation'] });
      if (data.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['activities', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['lead', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      }
      toast.success('Quotation sent via email successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to send email: ' + error.message);
    },
  });
}

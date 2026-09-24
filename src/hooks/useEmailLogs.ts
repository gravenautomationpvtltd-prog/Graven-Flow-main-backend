import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface EmailLog {
  id: string;
  email_id: string;
  quotation_id: string | null;
  recipient_email: string;
  cc_emails: string[];
  bcc_emails: string[];
  reply_to: string | null;
  subject: string | null;
  status: string;
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmailLogs(quotationId?: string) {
  const queryClient = useQueryClient();

  // Subscribe to real-time updates
  useEffect(() => {
    if (!quotationId) return;

    const channel = supabase
      .channel(`email-logs-${quotationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_logs',
          filter: `quotation_id=eq.${quotationId}`,
        },
        () => {
          // Invalidate and refetch on any change
          queryClient.invalidateQueries({ queryKey: ['email-logs', quotationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quotationId, queryClient]);

  return useQuery({
    queryKey: ['email-logs', quotationId],
    queryFn: async () => {
      let query = supabase
        .from('email_logs')
        .select('*')
        .order('sent_at', { ascending: false });

      if (quotationId) {
        query = query.eq('quotation_id', quotationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmailLog[];
    },
    enabled: !!quotationId,
  });
}

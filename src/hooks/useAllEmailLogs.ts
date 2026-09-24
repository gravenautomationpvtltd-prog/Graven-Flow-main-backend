import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

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
  quotation?: {
    id: string;
    quotation_number: string;
    lead_id: string | null;
    customer?: {
      company_name: string;
    } | null;
  } | null;
}

export interface EmailLogFilters {
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface EmailStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export function useAllEmailLogs(filters?: EmailLogFilters) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('all-email-logs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_logs',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['all-email-logs'] });
          queryClient.invalidateQueries({ queryKey: ['email-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['all-email-logs', filters, user?.id],
    queryFn: async () => {
      // Safety guard: If no user is logged in, return empty array
      if (!user?.id) {
        return [] as EmailLog[];
      }

      let query = supabase
        .from('email_logs')
        .select(`
          *,
          quotation:quotations (
            id,
            quotation_number,
            lead_id,
            customer:customers (
              company_name
            )
          )
        `)
        .eq('sent_by', user.id) // Always filter by logged-in user
        .order('sent_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.or(`recipient_email.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`);
      }

      if (filters?.dateFrom) {
        query = query.gte('sent_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('sent_at', filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmailLog[];
    },
  });
}

export function useEmailStats() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('email-stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_logs',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['email-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['email-stats', user?.id],
    queryFn: async () => {
      // Safety guard: If no user is logged in, return empty stats
      if (!user?.id) {
        return {
          total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0,
          deliveryRate: 0, openRate: 0, clickRate: 0, bounceRate: 0,
        } as EmailStats;
      }

      const { data, error } = await supabase
        .from('email_logs')
        .select('status, delivered_at, opened_at, clicked_at, bounced_at')
        .eq('sent_by', user.id); // Always filter by logged-in user

      if (error) throw error;

      const total = data.length;
      const sent = data.filter(e => e.status === 'sent' || e.status === 'delivered').length;
      const delivered = data.filter(e => e.delivered_at !== null).length;
      const opened = data.filter(e => e.opened_at !== null).length;
      const clicked = data.filter(e => e.clicked_at !== null).length;
      const bounced = data.filter(e => e.bounced_at !== null).length;

      return {
        total,
        sent,
        delivered,
        opened,
        clicked,
        bounced,
        deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
        openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
        clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
        bounceRate: total > 0 ? (bounced / total) * 100 : 0,
      } as EmailStats;
    },
  });
}

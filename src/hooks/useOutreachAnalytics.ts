import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OutreachRecord {
  id: string;
  customer_id: string;
  campaign_date: string;
  email_sent_at: string | null;
  whatsapp_sent_at: string | null;
  email_response_at: string | null;
  whatsapp_response_at: string | null;
  status: string | null;
  sent_by_user_id: string | null;
  created_at: string | null;
  customer: {
    company_name: string;
    contact_person: string | null;
  } | null;
  sent_by: {
    full_name: string | null;
  } | null;
}

export interface UserOutreachStats {
  userId: string;
  userName: string;
  emailCount: number;
  whatsappCount: number;
  responseCount: number;
  responseRate: number;
}

export function useOutreachAnalytics(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['outreach-analytics', dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('customer_outreach')
        .select(`
          id,
          customer_id,
          campaign_date,
          email_sent_at,
          whatsapp_sent_at,
          email_response_at,
          whatsapp_response_at,
          status,
          sent_by_user_id,
          created_at,
          customer:customers(company_name, contact_person),
          sent_by:profiles!customer_outreach_sent_by_user_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (dateFrom) query = query.gte('campaign_date', dateFrom);
      if (dateTo) query = query.lte('campaign_date', dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return data as OutreachRecord[];
    },
  });
}

export function useOutreachStatsByUser(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['outreach-stats-by-user', dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('customer_outreach')
        .select(`
          sent_by_user_id,
          email_sent_at,
          whatsapp_sent_at,
          email_response_at,
          whatsapp_response_at,
          status,
          sent_by:profiles!customer_outreach_sent_by_user_id_fkey(full_name)
        `);

      if (dateFrom) query = query.gte('campaign_date', dateFrom);
      if (dateTo) query = query.lte('campaign_date', dateTo);

      const { data, error } = await query;
      if (error) throw error;

      // Aggregate by user
      const userStatsMap = new Map<string, {
        userId: string;
        userName: string;
        emailCount: number;
        whatsappCount: number;
        responseCount: number;
      }>();

      data?.forEach((record: any) => {
        const userId = record.sent_by_user_id || 'unknown';
        const userName = record.sent_by?.full_name || 'System';

        if (!userStatsMap.has(userId)) {
          userStatsMap.set(userId, {
            userId,
            userName,
            emailCount: 0,
            whatsappCount: 0,
            responseCount: 0,
          });
        }

        const stats = userStatsMap.get(userId)!;
        if (record.email_sent_at) stats.emailCount++;
        if (record.whatsapp_sent_at) stats.whatsappCount++;
        if (record.email_response_at || record.whatsapp_response_at || record.status === 'responded') {
          stats.responseCount++;
        }
      });

      // Calculate response rates and convert to array
      const userStats: UserOutreachStats[] = Array.from(userStatsMap.values()).map(stats => ({
        ...stats,
        responseRate: (stats.emailCount + stats.whatsappCount) > 0
          ? (stats.responseCount / (stats.emailCount + stats.whatsappCount)) * 100
          : 0,
      }));

      // Sort by total outreach count descending
      userStats.sort((a, b) => (b.emailCount + b.whatsappCount) - (a.emailCount + a.whatsappCount));

      return userStats;
    },
  });
}

export function useOutreachTotals(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['outreach-totals', dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('customer_outreach')
        .select('email_sent_at, whatsapp_sent_at, email_response_at, whatsapp_response_at, status');

      if (dateFrom) query = query.gte('campaign_date', dateFrom);
      if (dateTo) query = query.lte('campaign_date', dateTo);

      const { data, error } = await query;
      if (error) throw error;

      let emailCount = 0;
      let whatsappCount = 0;
      let responseCount = 0;

      data?.forEach((record) => {
        if (record.email_sent_at) emailCount++;
        if (record.whatsapp_sent_at) whatsappCount++;
        if (record.email_response_at || record.whatsapp_response_at || record.status === 'responded') {
          responseCount++;
        }
      });

      const totalSent = emailCount + whatsappCount;
      const responseRate = totalSent > 0 ? (responseCount / totalSent) * 100 : 0;

      return {
        emailCount,
        whatsappCount,
        totalSent,
        responseCount,
        responseRate,
      };
    },
  });
}

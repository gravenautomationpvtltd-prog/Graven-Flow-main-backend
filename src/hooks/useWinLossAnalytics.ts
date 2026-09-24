import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WIN_REASONS, LOST_REASONS } from '@/components/leads/WinLossReasonDialog';
import { startOfMonth, subMonths, format } from 'date-fns';

export interface ReasonBreakdown {
  reason: string;
  label: string;
  count: number;
  percentage: number;
  totalValue: number;
}

export interface MonthlyTrend {
  month: string;
  monthLabel: string;
  won: number;
  lost: number;
  winRate: number;
  topWinReason: string | null;
  topLossReason: string | null;
}

export interface WinLossAnalyticsData {
  winReasons: ReasonBreakdown[];
  lossReasons: ReasonBreakdown[];
  monthlyTrends: MonthlyTrend[];
  totalWon: number;
  totalLost: number;
  overallWinRate: number;
  totalWonValue: number;
  totalLostValue: number;
}

const WIN_REASON_LABELS: Record<string, string> = {
  price: 'Competitive Price',
  quality: 'Product Quality',
  delivery_time: 'Fast Delivery',
  relationship: 'Customer Relationship',
  trust: 'Brand Trust',
  service: 'Better Service',
  other: 'Other',
};

const LOST_REASON_LABELS: Record<string, string> = {
  price: 'Price Too High',
  quality: 'Quality Concerns',
  delivery_time: 'Delivery Time',
  competitor: 'Went to Competitor',
  budget: 'Budget Constraints',
  no_response: 'No Response',
  not_needed: 'No Longer Needed',
  project_cancelled: 'Project Cancelled',
  wrong_contact: 'Wrong Contact',
  duplicate_lead: 'Duplicate Lead',
  other: 'Other',
};

export function useWinLossAnalytics(monthsBack: number = 6) {
  return useQuery({
    queryKey: ['win-loss-analytics', monthsBack],
    queryFn: async (): Promise<WinLossAnalyticsData> => {
      const startDate = subMonths(new Date(), monthsBack);

      // Fetch leads with win/loss status and reasons
      const { data: leads, error } = await supabase
        .from('leads')
        .select(`
          id,
          status,
          won_reason,
          lost_reason,
          created_at,
          updated_at,
          estimated_value
        `)
        .in('status', ['won', 'lost'])
        .gte('updated_at', startDate.toISOString())
        .order('updated_at', { ascending: true });

      if (error) throw error;

      const wonLeads = leads?.filter(l => l.status === 'won') || [];
      const lostLeads = leads?.filter(l => l.status === 'lost') || [];

      // Fetch ACTUAL order values for won leads
      const wonLeadIds = wonLeads.map(l => l.id);
      let orderValuesByLead = new Map<string, number>();
      if (wonLeadIds.length > 0) {
        const { data: orders } = await supabase
          .from('sales_orders')
          .select('lead_id, order_value')
          .in('lead_id', wonLeadIds);
        
        orders?.forEach(o => {
          if (o.lead_id) {
            orderValuesByLead.set(o.lead_id, (orderValuesByLead.get(o.lead_id) || 0) + (o.order_value || 0));
          }
        });
      }

      // For lost leads, fetch the latest quotation grand_total
      const lostLeadIds = lostLeads.map(l => l.id);
      let lostValuesByLead = new Map<string, number>();
      if (lostLeadIds.length > 0) {
        const { data: quotations } = await supabase
          .from('quotations')
          .select('lead_id, grand_total, created_at')
          .in('lead_id', lostLeadIds)
          .order('created_at', { ascending: false });
        
        // Group by lead_id and take the latest (first after ordering)
        quotations?.forEach(q => {
          if (q.lead_id && !lostValuesByLead.has(q.lead_id)) {
            lostValuesByLead.set(q.lead_id, q.grand_total || 0);
          }
        });
      }

      // Calculate win reason breakdown using ACTUAL order values
      const winReasonCounts = new Map<string, { count: number; value: number }>();
      wonLeads.forEach(lead => {
        const reason = lead.won_reason || 'unknown';
        const current = winReasonCounts.get(reason) || { count: 0, value: 0 };
        const actualValue = orderValuesByLead.get(lead.id) || lead.estimated_value || 0;
        winReasonCounts.set(reason, {
          count: current.count + 1,
          value: current.value + actualValue,
        });
      });

      const winReasons: ReasonBreakdown[] = Array.from(winReasonCounts.entries())
        .map(([reason, data]) => ({
          reason,
          label: WIN_REASON_LABELS[reason] || reason,
          count: data.count,
          percentage: wonLeads.length > 0 ? (data.count / wonLeads.length) * 100 : 0,
          totalValue: data.value,
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate loss reason breakdown using latest quotation values
      const lossReasonCounts = new Map<string, { count: number; value: number }>();
      lostLeads.forEach(lead => {
        const reason = lead.lost_reason || 'unknown';
        const current = lossReasonCounts.get(reason) || { count: 0, value: 0 };
        const lostValue = lostValuesByLead.get(lead.id) || lead.estimated_value || 0;
        lossReasonCounts.set(reason, {
          count: current.count + 1,
          value: current.value + lostValue,
        });
      });

      const lossReasons: ReasonBreakdown[] = Array.from(lossReasonCounts.entries())
        .map(([reason, data]) => ({
          reason,
          label: LOST_REASON_LABELS[reason] || reason,
          count: data.count,
          percentage: lostLeads.length > 0 ? (data.count / lostLeads.length) * 100 : 0,
          totalValue: data.value,
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate monthly trends
      const monthlyData = new Map<string, {
        won: number;
        lost: number;
        winReasons: Map<string, number>;
        lossReasons: Map<string, number>;
      }>();

      // Initialize months
      for (let i = monthsBack - 1; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthKey = format(monthDate, 'yyyy-MM');
        monthlyData.set(monthKey, {
          won: 0,
          lost: 0,
          winReasons: new Map(),
          lossReasons: new Map(),
        });
      }

      // Aggregate data by month
      leads?.forEach(lead => {
        const monthKey = format(new Date(lead.updated_at), 'yyyy-MM');
        const data = monthlyData.get(monthKey);
        if (data) {
          if (lead.status === 'won') {
            data.won++;
            if (lead.won_reason) {
              data.winReasons.set(
                lead.won_reason,
                (data.winReasons.get(lead.won_reason) || 0) + 1
              );
            }
          } else {
            data.lost++;
            if (lead.lost_reason) {
              data.lossReasons.set(
                lead.lost_reason,
                (data.lossReasons.get(lead.lost_reason) || 0) + 1
              );
            }
          }
        }
      });

      const monthlyTrends: MonthlyTrend[] = Array.from(monthlyData.entries()).map(
        ([month, data]) => {
          const total = data.won + data.lost;
          
          // Find top reasons
          let topWinReason: string | null = null;
          let topLossReason: string | null = null;
          
          let maxWinCount = 0;
          data.winReasons.forEach((count, reason) => {
            if (count > maxWinCount) {
              maxWinCount = count;
              topWinReason = WIN_REASON_LABELS[reason] || reason;
            }
          });

          let maxLossCount = 0;
          data.lossReasons.forEach((count, reason) => {
            if (count > maxLossCount) {
              maxLossCount = count;
              topLossReason = LOST_REASON_LABELS[reason] || reason;
            }
          });

          return {
            month,
            monthLabel: format(new Date(month + '-01'), 'MMM yyyy'),
            won: data.won,
            lost: data.lost,
            winRate: total > 0 ? (data.won / total) * 100 : 0,
            topWinReason,
            topLossReason,
          };
        }
      );

      // Calculate total values using ACTUAL order values for won, latest quotation for lost
      const totalWonValue = wonLeads.reduce((sum, l) => sum + (orderValuesByLead.get(l.id) || l.estimated_value || 0), 0);
      const totalLostValue = lostLeads.reduce((sum, l) => sum + (lostValuesByLead.get(l.id) || l.estimated_value || 0), 0);
      const total = wonLeads.length + lostLeads.length;

      return {
        winReasons,
        lossReasons,
        monthlyTrends,
        totalWon: wonLeads.length,
        totalLost: lostLeads.length,
        overallWinRate: total > 0 ? (wonLeads.length / total) * 100 : 0,
        totalWonValue,
        totalLostValue,
      };
    },
  });
}

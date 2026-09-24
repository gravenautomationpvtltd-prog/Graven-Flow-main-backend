import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, differenceInMonths, addMonths, startOfMonth } from 'date-fns';
import { DateRangeParam } from './useEmployeeStats';
import { useAuth } from '@/hooks/useAuth';

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
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  quotedCount: number;
  wonCount: number;
  lostCount: number;
  winRate: number;
  totalRevenue: number;
}

export interface DealDetail {
  id: string;
  leadId: string;
  leadTitle: string;
  customerName: string;
  customerId: string;
  outcome: 'won' | 'lost';
  reason: string;
  reasonLabel: string;
  quotationValue: number;
  orderValue: number;
  products: string[];
  closedDate: string;
}

export interface EmployeeDetailedStats {
  wonCount: number;
  lostCount: number;
  wonRevenue: number;
  lostValue: number;
  winRate: number;
  winReasons: ReasonBreakdown[];
  lossReasons: ReasonBreakdown[];
  monthlyTrends: MonthlyTrend[];
  productPerformance: ProductPerformance[];
  deals: DealDetail[];
}

export function useEmployeeDetailedStats(employeeId: string, dateRange?: DateRangeParam) {
  const { session } = useAuth();
  const fromISO = dateRange?.from?.toISOString();
  const toISO = dateRange?.to?.toISOString();

  return useQuery({
    queryKey: ['employee-detailed-stats', employeeId, fromISO, toISO, session?.access_token],
    queryFn: async (): Promise<EmployeeDetailedStats> => {
      const now = new Date();
      const startDate = dateRange?.from || subMonths(now, 12);
      const endDate = dateRange?.to || now;

      // Fetch won and lost leads for this employee
      let query = supabase
        .from('leads')
        .select(`
          id, title, status, won_reason, lost_reason, estimated_value, updated_at,
          customer:customers(id, company_name)
        `)
        .eq('assigned_to', employeeId)
        .in('status', ['won', 'lost'])
        .gte('updated_at', startDate.toISOString())
        .order('updated_at', { ascending: false });

      if (dateRange?.to) {
        query = query.lte('updated_at', endDate.toISOString());
      }

      const { data: leads, error } = await query;
      if (error) throw error;

      const wonLeads = leads?.filter(l => l.status === 'won') || [];
      const lostLeads = leads?.filter(l => l.status === 'lost') || [];
      const allLeadIds = leads?.map(l => l.id) || [];
      const wonLeadIds = wonLeads.map(l => l.id);

      // Fetch order values for won leads
      const orderValuesByLead = new Map<string, number>();
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

      // Fetch quotation values for all leads
      const quotationValuesByLead = new Map<string, number>();
      const productsByLead = new Map<string, string[]>();
      
      if (allLeadIds.length > 0) {
        const { data: quotations } = await supabase
          .from('quotations')
          .select(`
            id, lead_id, grand_total,
            items:quotation_items(product_id, description, product:products(id, name))
          `)
          .in('lead_id', allLeadIds)
          .order('created_at', { ascending: false });
        
        quotations?.forEach(q => {
          if (q.lead_id && !quotationValuesByLead.has(q.lead_id)) {
            quotationValuesByLead.set(q.lead_id, q.grand_total || 0);
            const products = (q.items as any[])?.map(item => 
              item.product?.name || item.description
            ).filter(Boolean) || [];
            productsByLead.set(q.lead_id, products);
          }
        });
      }

      // Build deals list
      const deals: DealDetail[] = leads?.map(lead => {
        const isWon = lead.status === 'won';
        const reason = isWon ? (lead.won_reason || 'unknown') : (lead.lost_reason || 'unknown');
        const reasonLabel = isWon 
          ? (WIN_REASON_LABELS[reason] || reason)
          : (LOST_REASON_LABELS[reason] || reason);

        return {
          id: lead.id,
          leadId: lead.id,
          leadTitle: lead.title,
          customerName: (lead.customer as any)?.company_name || 'Unknown',
          customerId: (lead.customer as any)?.id || '',
          outcome: lead.status as 'won' | 'lost',
          reason,
          reasonLabel,
          quotationValue: quotationValuesByLead.get(lead.id) || 0,
          orderValue: orderValuesByLead.get(lead.id) || 0,
          products: productsByLead.get(lead.id) || [],
          closedDate: lead.updated_at,
        };
      }) || [];

      // Calculate win reason breakdown
      const winReasonCounts = new Map<string, { count: number; value: number }>();
      wonLeads.forEach(lead => {
        const reason = lead.won_reason || 'unknown';
        const current = winReasonCounts.get(reason) || { count: 0, value: 0 };
        const value = orderValuesByLead.get(lead.id) || quotationValuesByLead.get(lead.id) || 0;
        winReasonCounts.set(reason, { count: current.count + 1, value: current.value + value });
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

      // Calculate loss reason breakdown
      const lossReasonCounts = new Map<string, { count: number; value: number }>();
      lostLeads.forEach(lead => {
        const reason = lead.lost_reason || 'unknown';
        const current = lossReasonCounts.get(reason) || { count: 0, value: 0 };
        const value = quotationValuesByLead.get(lead.id) || lead.estimated_value || 0;
        lossReasonCounts.set(reason, { count: current.count + 1, value: current.value + value });
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

      // Calculate monthly trends based on date range
      const monthsBack = Math.max(differenceInMonths(endDate, startDate), 1);
      const monthlyData = new Map<string, { won: number; lost: number }>();
      for (let i = 0; i <= monthsBack; i++) {
        const monthKey = format(addMonths(startOfMonth(startDate), i), 'yyyy-MM');
        monthlyData.set(monthKey, { won: 0, lost: 0 });
      }

      leads?.forEach(lead => {
        const monthKey = format(new Date(lead.updated_at), 'yyyy-MM');
        const data = monthlyData.get(monthKey);
        if (data) {
          if (lead.status === 'won') data.won++;
          else data.lost++;
        }
      });

      const monthlyTrends: MonthlyTrend[] = Array.from(monthlyData.entries()).map(([month, data]) => {
        const total = data.won + data.lost;
        return {
          month,
          monthLabel: format(new Date(month + '-01'), 'MMM yy'),
          won: data.won,
          lost: data.lost,
          winRate: total > 0 ? (data.won / total) * 100 : 0,
        };
      });

      // Fetch product performance
      const { data: negotiations } = await supabase
        .from('quotation_item_negotiations')
        .select('product_id, product_name, outcome, final_rate, initial_quoted_rate, lead_id')
        .in('lead_id', allLeadIds.length > 0 ? allLeadIds : ['00000000-0000-0000-0000-000000000000']);

      const productStats = new Map<string, {
        productId: string; productName: string;
        quotedCount: number; wonCount: number; lostCount: number; totalRevenue: number;
      }>();

      negotiations?.forEach(neg => {
        if (!neg.product_id) return;
        const existing = productStats.get(neg.product_id) || {
          productId: neg.product_id, productName: neg.product_name || 'Unknown',
          quotedCount: 0, wonCount: 0, lostCount: 0, totalRevenue: 0,
        };
        existing.quotedCount++;
        if (neg.outcome === 'won') {
          existing.wonCount++;
          existing.totalRevenue += neg.final_rate || neg.initial_quoted_rate || 0;
        } else if (neg.outcome === 'lost') {
          existing.lostCount++;
        }
        productStats.set(neg.product_id, existing);
      });

      const productPerformance: ProductPerformance[] = Array.from(productStats.values())
        .map(p => ({ ...p, winRate: p.quotedCount > 0 ? (p.wonCount / p.quotedCount) * 100 : 0 }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      const wonRevenue = wonLeads.reduce((sum, l) => 
        sum + (orderValuesByLead.get(l.id) || quotationValuesByLead.get(l.id) || 0), 0);
      const lostValue = lostLeads.reduce((sum, l) => 
        sum + (quotationValuesByLead.get(l.id) || l.estimated_value || 0), 0);
      const total = wonLeads.length + lostLeads.length;

      return {
        wonCount: wonLeads.length,
        lostCount: lostLeads.length,
        wonRevenue, lostValue,
        winRate: total > 0 ? (wonLeads.length / total) * 100 : 0,
        winReasons, lossReasons, monthlyTrends, productPerformance, deals,
      };
    },
    enabled: !!employeeId && !!session,
  });
}

export function useEmployeeQuotations(employeeId: string, dateRange?: DateRangeParam) {
  const { session } = useAuth();
  const fromISO = dateRange?.from?.toISOString();
  const toISO = dateRange?.to?.toISOString();

  return useQuery({
    queryKey: ['employee-quotations', employeeId, fromISO, toISO, session?.access_token],
    queryFn: async () => {
      let query = supabase
        .from('quotations')
        .select(`
          id, quotation_number, grand_total, is_converted, created_at,
          lead:leads(id, title, customer:customers(id, company_name)),
          items:quotation_items(id, description, quantity, rate, product:products(id, name))
        `)
        .eq('created_by', employeeId)
        .order('created_at', { ascending: false });

      if (fromISO) query = query.gte('created_at', fromISO);
      if (toISO) query = query.lte('created_at', toISO);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && !!session,
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Lead Conversion Funnel
export interface ConversionFunnelData {
  stage: string;
  count: number;
  value: number;
  conversion_rate: number;
}

// Customer Health Report
export interface CustomerHealthData {
  customer_id: string;
  company_name: string;
  total_leads: number;
  total_quotes: number;
  total_orders: number;
  conversion_rate: number;
  total_revenue: number;
  days_since_last_order: number | null;
  health_status: 'healthy' | 'at_risk' | 'churned' | 'new';
}

// Sales Pipeline Report
export interface PipelineData {
  status: string;
  count: number;
  value: number;
  avg_age_days: number;
}

export function useConversionFunnel(dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ['actionable-reports', 'conversion-funnel', dateFrom?.toISOString(), dateTo?.toISOString()],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ConversionFunnelData[]> => {
      let leadsQuery = supabase
        .from('leads')
        .select('id, status, estimated_value, created_at');

      if (dateFrom) leadsQuery = leadsQuery.gte('created_at', dateFrom.toISOString());
      if (dateTo) leadsQuery = leadsQuery.lte('created_at', dateTo.toISOString());

      const { data: leads, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      const totalLeads = leads?.length || 0;

      const statusGroups: Record<string, { count: number; value: number }> = {};
      const allStatuses = ['new', 'contacted', 'qualified', 'proposal', 'quoted', 'negotiation', 'won', 'lost'];
      allStatuses.forEach(s => { statusGroups[s] = { count: 0, value: 0 }; });
      
      leads?.forEach(l => {
        const status = l.status || 'new';
        if (statusGroups[status]) {
          statusGroups[status].count++;
          statusGroups[status].value += l.estimated_value || 0;
        }
      });

      const stageOrder = ['new', 'contacted', 'qualified', 'proposal', 'quoted', 'negotiation', 'won'];
      const stageLabels: Record<string, string> = {
        'new': 'New', 'contacted': 'Contacted', 'qualified': 'Qualified',
        'proposal': 'Proposal', 'quoted': 'Quoted', 'negotiation': 'Negotiation', 'won': 'Won',
      };

      const statusRank: Record<string, number> = {};
      allStatuses.forEach((s, i) => { statusRank[s] = i; });
      statusRank['lost'] = statusRank['quoted'];

      // Get price match data
      const leadIds = leads?.map(l => l.id) || [];
      let priceMatchedLeadIds = new Set<string>();
      if (leadIds.length > 0) {
        const CHUNK = 300;
        for (let i = 0; i < leadIds.length; i += CHUNK) {
          const chunk = leadIds.slice(i, i + CHUNK);
          const { data: quotations } = await supabase
            .from('quotations')
            .select('lead_id, is_price_matched')
            .in('lead_id', chunk)
            .eq('is_price_matched', true);
          quotations?.forEach(q => { if (q.lead_id) priceMatchedLeadIds.add(q.lead_id); });
        }
      }

      const funnel: ConversionFunnelData[] = stageOrder.map(stage => {
        const stageIdx = stageOrder.indexOf(stage);
        let count = 0;
        let value = 0;

        if (stage === 'won') {
          count = statusGroups['won'].count;
          value = statusGroups['won'].value;
        } else {
          leads?.forEach(l => {
            const lStatus = l.status || 'new';
            const lRank = statusRank[lStatus] ?? 0;
            if (lRank >= stageIdx) {
              count++;
              value += l.estimated_value || 0;
            }
          });
        }

        return {
          stage: stageLabels[stage],
          count, value,
          conversion_rate: totalLeads > 0 ? (count / totalLeads) * 100 : 0,
        };
      });

      // Insert "Price Matched" between Negotiation and Won
      const priceMatchedCount = priceMatchedLeadIds.size;
      const priceMatchedValue = leads?.filter(l => priceMatchedLeadIds.has(l.id)).reduce((s, l) => s + (l.estimated_value || 0), 0) || 0;
      const wonIdx = funnel.findIndex(f => f.stage === 'Won');
      funnel.splice(wonIdx, 0, {
        stage: 'Price Matched',
        count: priceMatchedCount,
        value: priceMatchedValue,
        conversion_rate: totalLeads > 0 ? (priceMatchedCount / totalLeads) * 100 : 0,
      });

      return funnel;
    },
  });
}

// Executive summary KPIs
export interface ExecutiveSummary {
  activePipelineValue: number;
  activePipelineCount: number;
  winRate: number;
  avgDealCycleDays: number;
  priceMatchRate: number;
  revenueWon: number;
  lostValue: number;
  lostCount: number;
}

export function useSalesExecutiveSummary(dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ['actionable-reports', 'executive-summary', dateFrom?.toISOString(), dateTo?.toISOString()],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ExecutiveSummary> => {
      let leadsQuery = supabase
        .from('leads')
        .select('id, status, estimated_value, created_at, won_at');
      if (dateFrom) leadsQuery = leadsQuery.gte('created_at', dateFrom.toISOString());
      if (dateTo) leadsQuery = leadsQuery.lte('created_at', dateTo.toISOString());

      const { data: leads } = await leadsQuery;
      const allLeads = leads || [];

      const activeStatuses = ['new', 'contacted', 'qualified', 'proposal', 'quoted', 'negotiation'];
      const activeLeads = allLeads.filter(l => activeStatuses.includes(l.status || ''));
      const wonLeads = allLeads.filter(l => l.status === 'won');
      const lostLeads = allLeads.filter(l => l.status === 'lost');
      const decidedLeads = wonLeads.length + lostLeads.length;

      const cycleDays: number[] = [];
      wonLeads.forEach(l => {
        if (l.won_at) {
          const d = (new Date(l.won_at).getTime() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24);
          if (d >= 0 && d < 365) cycleDays.push(d);
        }
      });

      const leadIds = allLeads.map(l => l.id);
      let totalQuotations = 0;
      let priceMatchedQuotations = 0;
      if (leadIds.length > 0) {
        const CHUNK = 300;
        for (let i = 0; i < leadIds.length; i += CHUNK) {
          const chunk = leadIds.slice(i, i + CHUNK);
          const { data: qs } = await supabase
            .from('quotations')
            .select('id, is_price_matched')
            .in('lead_id', chunk)
            .is('deleted_at', null);
          totalQuotations += qs?.length || 0;
          priceMatchedQuotations += qs?.filter(q => q.is_price_matched).length || 0;
        }
      }

      let revenueWon = 0;
      const wonLeadIds = wonLeads.map(l => l.id);
      if (wonLeadIds.length > 0) {
        const CHUNK = 300;
        for (let i = 0; i < wonLeadIds.length; i += CHUNK) {
          const chunk = wonLeadIds.slice(i, i + CHUNK);
          const { data: orders } = await supabase
            .from('sales_orders')
            .select('order_value')
            .in('lead_id', chunk);
          revenueWon += orders?.reduce((s, o) => s + (o.order_value || 0), 0) || 0;
        }
      }

      return {
        activePipelineValue: activeLeads.reduce((s, l) => s + (l.estimated_value || 0), 0),
        activePipelineCount: activeLeads.length,
        winRate: decidedLeads > 0 ? (wonLeads.length / decidedLeads) * 100 : 0,
        avgDealCycleDays: cycleDays.length > 0 ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) : 0,
        priceMatchRate: totalQuotations > 0 ? (priceMatchedQuotations / totalQuotations) * 100 : 0,
        revenueWon,
        lostValue: lostLeads.reduce((s, l) => s + (l.estimated_value || 0), 0),
        lostCount: lostLeads.length,
      };
    },
  });
}

// Negotiation effectiveness
export interface NegotiationEffectiveness {
  quotedCount: number;
  quotedValue: number;
  inNegotiationCount: number;
  inNegotiationValue: number;
  priceMatchedCount: number;
  priceMatchedValue: number;
  convertedCount: number;
  convertedValue: number;
  avgNegotiationDays: number;
  matchedConversionRate: number;
  unmatchedConversionRate: number;
}

export function useNegotiationEffectiveness(dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ['actionable-reports', 'negotiation-effectiveness', dateFrom?.toISOString(), dateTo?.toISOString()],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<NegotiationEffectiveness> => {
      let leadsQuery = supabase
        .from('leads')
        .select('id, status, estimated_value, created_at');
      if (dateFrom) leadsQuery = leadsQuery.gte('created_at', dateFrom.toISOString());
      if (dateTo) leadsQuery = leadsQuery.lte('created_at', dateTo.toISOString());

      const { data: leads } = await leadsQuery;
      const allLeads = leads || [];

      const quotedStatuses = ['quoted', 'negotiation', 'won', 'lost'];
      const quotedLeads = allLeads.filter(l => quotedStatuses.includes(l.status || ''));
      const negotiationLeads = allLeads.filter(l => l.status === 'negotiation');

      const leadIds = allLeads.map(l => l.id);
      let quotations: any[] = [];
      if (leadIds.length > 0) {
        const CHUNK = 300;
        for (let i = 0; i < leadIds.length; i += CHUNK) {
          const chunk = leadIds.slice(i, i + CHUNK);
          const { data: qs } = await supabase
            .from('quotations')
            .select('id, lead_id, is_price_matched, is_converted, created_at, grand_total, price_matched_at')
            .in('lead_id', chunk)
            .is('deleted_at', null);
          quotations.push(...(qs || []));
        }
      }

      const priceMatched = quotations.filter(q => q.is_price_matched);
      const converted = quotations.filter(q => q.is_converted);
      const matchedConverted = priceMatched.filter(q => q.is_converted);
      const unmatchedQuotations = quotations.filter(q => !q.is_price_matched);
      const unmatchedConverted = unmatchedQuotations.filter(q => q.is_converted);

      const negDays: number[] = [];
      priceMatched.forEach(q => {
        if (q.price_matched_at) {
          const d = (new Date(q.price_matched_at).getTime() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24);
          if (d >= 0 && d < 365) negDays.push(d);
        }
      });

      return {
        quotedCount: quotedLeads.length,
        quotedValue: quotedLeads.reduce((s, l) => s + (l.estimated_value || 0), 0),
        inNegotiationCount: negotiationLeads.length,
        inNegotiationValue: negotiationLeads.reduce((s, l) => s + (l.estimated_value || 0), 0),
        priceMatchedCount: priceMatched.length,
        priceMatchedValue: priceMatched.reduce((s, q) => s + (q.grand_total || 0), 0),
        convertedCount: converted.length,
        convertedValue: converted.reduce((s, q) => s + (q.grand_total || 0), 0),
        avgNegotiationDays: negDays.length > 0 ? Math.round(negDays.reduce((a, b) => a + b, 0) / negDays.length) : 0,
        matchedConversionRate: priceMatched.length > 0 ? (matchedConverted.length / priceMatched.length) * 100 : 0,
        unmatchedConversionRate: unmatchedQuotations.length > 0 ? (unmatchedConverted.length / unmatchedQuotations.length) * 100 : 0,
      };
    },
  });
}

// Smart recommendations
export interface SmartRecommendation {
  id: string;
  type: 'warning' | 'info' | 'action';
  title: string;
  description: string;
  value?: number;
  count?: number;
  linkTo?: string;
}

export function useSmartRecommendations(dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ['actionable-reports', 'smart-recommendations', dateFrom?.toISOString(), dateTo?.toISOString()],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SmartRecommendation[]> => {
      const recommendations: SmartRecommendation[] = [];

      // 1. Stuck in negotiation > 14 days
      const { data: stuckLeads } = await supabase
        .from('leads')
        .select('id, estimated_value, updated_at')
        .eq('status', 'negotiation');

      const now = new Date();
      const stuckCount = stuckLeads?.filter(l => {
        const days = (now.getTime() - new Date(l.updated_at || l.id).getTime()) / (1000 * 60 * 60 * 24);
        return days > 14;
      }) || [];
      
      if (stuckCount.length > 0) {
        recommendations.push({
          id: 'stuck-negotiation',
          type: 'warning',
          title: `${stuckCount.length} deals stuck in negotiation`,
          description: `These deals have been in negotiation for over 14 days — consider price review or escalation.`,
          count: stuckCount.length,
          value: stuckCount.reduce((s, l) => s + (l.estimated_value || 0), 0),
          linkTo: '/leads?status=negotiation',
        });
      }

      // 2. Lost deal analysis
      let lostQuery = supabase
        .from('leads')
        .select('id, estimated_value, lost_reason')
        .eq('status', 'lost');
      if (dateFrom) lostQuery = lostQuery.gte('created_at', dateFrom.toISOString());
      if (dateTo) lostQuery = lostQuery.lte('created_at', dateTo.toISOString());

      const { data: lostLeads } = await lostQuery;
      if (lostLeads && lostLeads.length > 0) {
        const reasonCounts: Record<string, { count: number; value: number }> = {};
        lostLeads.forEach(l => {
          const reason = l.lost_reason || 'No reason specified';
          if (!reasonCounts[reason]) reasonCounts[reason] = { count: 0, value: 0 };
          reasonCounts[reason].count++;
          reasonCounts[reason].value += l.estimated_value || 0;
        });
        const topReason = Object.entries(reasonCounts).sort((a, b) => b[1].value - a[1].value)[0];
        if (topReason) {
          recommendations.push({
            id: 'top-loss-reason',
            type: 'action',
            title: `Top loss reason: "${topReason[0]}"`,
            description: `${topReason[1].count} deals lost for this reason — needs strategic attention.`,
            count: topReason[1].count,
            value: topReason[1].value,
            linkTo: '/leads?status=lost',
          });
        }
      }

      // 3. Unmatched quotations needing pricing
      const { data: unmatchedQuotes } = await supabase
        .from('quotations')
        .select('id, grand_total, customer_id')
        .eq('is_price_matched', false)
        .eq('is_converted', false)
        .is('deleted_at', null);
      
      if (unmatchedQuotes && unmatchedQuotes.length > 5) {
        recommendations.push({
          id: 'unmatched-quotes',
          type: 'info',
          title: `${unmatchedQuotes.length} quotations awaiting price match`,
          description: `These quotations haven't been price-matched yet — pricing team action needed.`,
          count: unmatchedQuotes.length,
          value: unmatchedQuotes.reduce((s, q) => s + (q.grand_total || 0), 0),
        });
      }

      // 4. High-value leads with no follow-up
      const { data: staleLeads } = await supabase
        .from('leads')
        .select('id, estimated_value, status, updated_at')
        .in('status', ['new', 'contacted'])
        .gt('estimated_value', 100000);

      const staleCount = staleLeads?.filter(l => {
        const days = (now.getTime() - new Date(l.updated_at || '').getTime()) / (1000 * 60 * 60 * 24);
        return days > 7;
      }) || [];

      if (staleCount.length > 0) {
        recommendations.push({
          id: 'stale-high-value',
          type: 'warning',
          title: `${staleCount.length} high-value leads going cold`,
          description: `Leads worth ₹1L+ with no activity for 7+ days — immediate follow-up recommended.`,
          count: staleCount.length,
          value: staleCount.reduce((s, l) => s + (l.estimated_value || 0), 0),
          linkTo: '/leads?status=new,contacted',
        });
      }

      return recommendations;
    },
  });
}

export function useCustomerHealthReport(limit: number = 50, dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ['actionable-reports', 'customer-health', limit, dateFrom?.toISOString(), dateTo?.toISOString()],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CustomerHealthData[]> => {
      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, company_name, created_at')
        .is('deleted_at', null)
        .limit(500);

      if (error) throw error;

      // Get leads (date-filtered)
      let leadsQuery = supabase
        .from('leads')
        .select('customer_id, status, estimated_value')
        .not('customer_id', 'is', null);
      if (dateFrom) leadsQuery = leadsQuery.gte('created_at', dateFrom.toISOString());
      if (dateTo) leadsQuery = leadsQuery.lte('created_at', dateTo.toISOString());
      const { data: leads } = await leadsQuery;

      // Get orders (date-filtered)
      let ordersQuery = supabase
        .from('sales_orders')
        .select('customer_id, order_value, created_at')
        .not('customer_id', 'is', null);
      if (dateFrom) ordersQuery = ordersQuery.gte('created_at', dateFrom.toISOString());
      if (dateTo) ordersQuery = ordersQuery.lte('created_at', dateTo.toISOString());
      const { data: orders } = await ordersQuery;

      // Get quotations (date-filtered)
      let quotationsQuery = supabase
        .from('quotations')
        .select('id, lead:leads (customer_id)')
        .is('deleted_at', null);
      if (dateFrom) quotationsQuery = quotationsQuery.gte('created_at', dateFrom.toISOString());
      if (dateTo) quotationsQuery = quotationsQuery.lte('created_at', dateTo.toISOString());
      const { data: quotations } = await quotationsQuery;

      // Aggregate
      const customerMetrics = new Map<string, {
        company_name: string;
        total_leads: number;
        total_quotes: number;
        total_orders: number;
        total_revenue: number;
        last_order_date: string | null;
        created_at: string;
      }>();

      customers?.forEach(c => {
        customerMetrics.set(c.id, {
          company_name: c.company_name,
          total_leads: 0, total_quotes: 0, total_orders: 0, total_revenue: 0,
          last_order_date: null, created_at: c.created_at
        });
      });

      leads?.forEach(l => {
        const m = customerMetrics.get(l.customer_id);
        if (m) m.total_leads++;
      });

      quotations?.forEach((q: any) => {
        const customerId = q.lead?.customer_id;
        if (customerId) {
          const m = customerMetrics.get(customerId);
          if (m) m.total_quotes++;
        }
      });

      orders?.forEach((o: any) => {
        const m = customerMetrics.get(o.customer_id);
        if (m) {
          m.total_orders++;
          m.total_revenue += o.order_value || 0;
          if (!m.last_order_date || o.created_at > m.last_order_date) {
            m.last_order_date = o.created_at;
          }
        }
      });

      const now = new Date();
      return Array.from(customerMetrics.entries())
        .map(([customer_id, data]) => {
          const daysSinceOrder = data.last_order_date
            ? Math.floor((now.getTime() - new Date(data.last_order_date).getTime()) / (1000 * 60 * 60 * 24))
            : null;
          const conversionRate = data.total_leads > 0 ? (data.total_orders / data.total_leads) * 100 : 0;

          let healthStatus: 'healthy' | 'at_risk' | 'churned' | 'new';
          if (data.total_orders === 0 && data.total_leads <= 1) healthStatus = 'new';
          else if (daysSinceOrder !== null && daysSinceOrder > 180) healthStatus = 'churned';
          else if (daysSinceOrder !== null && daysSinceOrder > 90) healthStatus = 'at_risk';
          else if (data.total_orders > 0) healthStatus = 'healthy';
          else healthStatus = 'at_risk';

          return {
            customer_id, company_name: data.company_name,
            total_leads: data.total_leads, total_quotes: data.total_quotes,
            total_orders: data.total_orders, conversion_rate: conversionRate,
            total_revenue: data.total_revenue, days_since_last_order: daysSinceOrder,
            health_status: healthStatus
          };
        })
        .filter(c => c.total_leads > 0 || c.total_orders > 0)
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, limit);
    },
  });
}

export function useSalesPipelineReport(dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ['actionable-reports', 'sales-pipeline', dateFrom?.toISOString(), dateTo?.toISOString()],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PipelineData[]> => {
      let leadsQuery = supabase
        .from('leads')
        .select('id, status, estimated_value, created_at')
        .not('status', 'in', '(won,lost)');

      if (dateFrom) leadsQuery = leadsQuery.gte('created_at', dateFrom.toISOString());
      if (dateTo) leadsQuery = leadsQuery.lte('created_at', dateTo.toISOString());

      const { data: leads, error } = await leadsQuery;
      if (error) throw error;

      const now = new Date();
      const pipelineData = new Map<string, { count: number; value: number; ages: number[] }>();

      leads?.forEach(lead => {
        const status = lead.status || 'new';
        if (!pipelineData.has(status)) pipelineData.set(status, { count: 0, value: 0, ages: [] });
        const data = pipelineData.get(status)!;
        data.count++;
        data.value += lead.estimated_value || 0;
        data.ages.push(Math.floor((now.getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)));
      });

      const statusOrder = ['new', 'contacted', 'engaged', 'qualified', 'proposal', 'quoted', 'negotiation'];
      return statusOrder
        .filter(status => pipelineData.has(status))
        .map(status => {
          const data = pipelineData.get(status)!;
          return {
            status: status.charAt(0).toUpperCase() + status.slice(1),
            count: data.count, value: data.value,
            avg_age_days: data.ages.length > 0 ? Math.round(data.ages.reduce((a, b) => a + b, 0) / data.ages.length) : 0
          };
        });
    },
  });
}

// High-quote low-order customers
export interface HighQuoteLowOrderCustomer {
  customer_id: string;
  company_name: string;
  quotes_received: number;
  orders_placed: number;
  conversion_gap: number;
  potential_revenue: number;
  recommendation: string;
}

export function useHighQuoteLowOrderCustomers(limit: number = 20, dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ['actionable-reports', 'high-quote-low-order', limit, dateFrom?.toISOString(), dateTo?.toISOString()],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<HighQuoteLowOrderCustomer[]> => {
      let leadsQuery = supabase
        .from('leads')
        .select(`id, customer_id, status, estimated_value, customer:customers (id, company_name)`)
        .not('customer_id', 'is', null);
      if (dateFrom) leadsQuery = leadsQuery.gte('created_at', dateFrom.toISOString());
      if (dateTo) leadsQuery = leadsQuery.lte('created_at', dateTo.toISOString());

      const { data: leads, error } = await leadsQuery;
      if (error) throw error;

      let quotationsQuery = supabase.from('quotations').select('lead_id').is('deleted_at', null);
      if (dateFrom) quotationsQuery = quotationsQuery.gte('created_at', dateFrom.toISOString());
      if (dateTo) quotationsQuery = quotationsQuery.lte('created_at', dateTo.toISOString());
      const { data: quotations } = await quotationsQuery;

      const quotationsByLead = new Map<string, number>();
      quotations?.forEach(q => {
        quotationsByLead.set(q.lead_id, (quotationsByLead.get(q.lead_id) || 0) + 1);
      });

      const customerData = new Map<string, { company_name: string; quotes: number; orders: number; potential: number }>();

      leads?.forEach((lead: any) => {
        const customerId = lead.customer?.id;
        if (!customerId) return;
        if (!customerData.has(customerId)) {
          customerData.set(customerId, { company_name: lead.customer.company_name || 'Unknown', quotes: 0, orders: 0, potential: 0 });
        }
        const data = customerData.get(customerId)!;
        if (quotationsByLead.has(lead.id)) data.quotes++;
        if (lead.status === 'won') data.orders++;
        data.potential += lead.estimated_value || 0;
      });

      return Array.from(customerData.entries())
        .filter(([_, data]) => data.quotes >= 3 && data.orders < data.quotes * 0.3)
        .map(([customer_id, data]) => ({
          customer_id, company_name: data.company_name,
          quotes_received: data.quotes, orders_placed: data.orders,
          conversion_gap: data.quotes - data.orders,
          potential_revenue: data.potential,
          recommendation: data.orders === 0 ? 'Needs immediate follow-up' : 'Review pricing strategy'
        }))
        .sort((a, b) => b.potential_revenue - a.potential_revenue)
        .slice(0, limit);
    },
  });
}

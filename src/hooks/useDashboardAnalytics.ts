import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, subMonths, format } from 'date-fns';
import { useVertical } from '@/contexts/VerticalContext';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface LeadTrendData {
  month: string;
  leads: number;
  indiamart: number;
  tradeindia: number;
  manual: number;
  other: number;
}

export interface PipelineData {
  status: string;
  count: number;
  label: string;
  color: string;
}

export interface ProcurementData {
  status: string;
  count: number;
  value: number;
  label: string;
  color: string;
}

export interface LeadSourceData {
  source: string;
  count: number;
  label: string;
  fill: string;
}

export interface PipelineStage {
  stage: string;
  label: string;
  count: number;
  rawValue: number;
  probability: number;
  weightedValue: number;
  color: string;
}

export interface RevenueForecastData {
  pipelineByStage: PipelineStage[];
  totalPipelineValue: number;
  weightedForecast: number;
  historicalWinRate: number;
}

const STALE = 5 * 60 * 1000;

export function useDashboardAnalytics(dateRange?: DateRange, enabled: boolean = true, assignedTo?: string) {
  const { activeVerticalId } = useVertical();
  // Single consolidated query for leadTrends + salesPipeline + leadSources
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['dashboard-leads-consolidated', activeVerticalId, assignedTo ?? null, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    enabled,
    staleTime: STALE,
    queryFn: async () => {
      const now = new Date();
      const sixMonthsAgo = startOfMonth(subMonths(now, 5));
      const effectiveFrom = dateRange?.from && dateRange.from > sixMonthsAgo ? dateRange.from : sixMonthsAgo;

      let query: any = supabase
        .from('leads')
        .select('source, status, created_at')
        .gte('created_at', effectiveFrom.toISOString());

      if (activeVerticalId) query = query.eq('vertical_id', activeVerticalId);
      if (assignedTo) query = query.eq('assigned_to', assignedTo);
      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // --- Lead Trends ---
      const monthBuckets: Record<string, LeadTrendData> = {};
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(now, i));
        const monthEnd = startOfMonth(subMonths(now, i - 1));
        if (dateRange?.from && monthEnd < dateRange.from) continue;
        if (dateRange?.to && monthStart > dateRange.to) continue;
        const key = format(monthStart, 'yyyy-MM');
        monthBuckets[key] = { month: format(monthStart, 'MMM'), leads: 0, indiamart: 0, tradeindia: 0, manual: 0, other: 0 };
      }

      const statusCounts: Record<string, number> = {};
      const sourceCounts: Record<string, number> = {};

      (data || []).forEach(lead => {
        // Trends
        const key = format(new Date(lead.created_at), 'yyyy-MM');
        const bucket = monthBuckets[key];
        if (bucket) {
          bucket.leads++;
          if (lead.source === 'indiamart') bucket.indiamart++;
          else if (lead.source === 'tradeindia') bucket.tradeindia++;
          else if (lead.source === 'manual') bucket.manual++;
          else bucket.other++;
        }
        // Pipeline
        statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
        // Sources
        sourceCounts[lead.source] = (sourceCounts[lead.source] || 0) + 1;
      });

      // --- Sales Pipeline ---
      const statusConfig: Record<string, { label: string; color: string; order: number }> = {
        new: { label: 'New', color: 'hsl(var(--chart-1))', order: 1 },
        contacted: { label: 'Contacted', color: 'hsl(var(--chart-2))', order: 2 },
        engaged: { label: 'Engaged', color: 'hsl(var(--chart-3))', order: 3 },
        quoted: { label: 'Quoted', color: 'hsl(var(--chart-4))', order: 4 },
        negotiation: { label: 'Negotiation', color: 'hsl(var(--chart-5))', order: 5 },
        won: { label: 'Won', color: 'hsl(var(--success))', order: 6 },
        lost: { label: 'Lost', color: 'hsl(var(--destructive))', order: 7 },
      };

      const salesPipeline: PipelineData[] = Object.entries(statusCounts)
        .map(([status, count]) => ({
          status, count,
          label: statusConfig[status]?.label || status,
          color: statusConfig[status]?.color || 'hsl(var(--muted))',
        }))
        .sort((a, b) => (statusConfig[a.status]?.order || 99) - (statusConfig[b.status]?.order || 99));

      // --- Lead Sources ---
      const sourceConfig: Record<string, { label: string; fill: string }> = {
        indiamart: { label: 'IndiaMART', fill: 'hsl(var(--chart-1))' },
        tradeindia: { label: 'TradeIndia', fill: 'hsl(var(--chart-2))' },
        justdial: { label: 'JustDial', fill: 'hsl(var(--chart-3))' },
        whatsapp: { label: 'WhatsApp', fill: 'hsl(var(--chart-4))' },
        website: { label: 'Website', fill: 'hsl(var(--chart-5))' },
        manual: { label: 'Manual', fill: 'hsl(var(--primary))' },
      };

      const leadSources: LeadSourceData[] = Object.entries(sourceCounts).map(([source, count]) => ({
        source, count,
        label: sourceConfig[source]?.label || source,
        fill: sourceConfig[source]?.fill || 'hsl(var(--muted))',
      }));

      return {
        leadTrends: Object.values(monthBuckets),
        salesPipeline,
        leadSources,
      };
    },
  });

  // Procurement — separate table, keep as own query
  const { data: procurementStatus, isLoading: procurementLoading } = useQuery({
    queryKey: ['dashboard-procurement-status', activeVerticalId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    enabled,
    staleTime: STALE,
    queryFn: async (): Promise<ProcurementData[]> => {
      let query: any = supabase.from('purchase_orders').select('status, grand_total');
      if (activeVerticalId) query = query.eq('vertical_id', activeVerticalId);
      if (dateRange?.from) query = query.gte('created_at', dateRange.from.toISOString());
      if (dateRange?.to) query = query.lte('created_at', dateRange.to.toISOString());

      const { data, error } = await query;
      if (error) throw error;

      const statusAgg: Record<string, { count: number; value: number }> = {};
      data?.forEach((po) => {
        if (!statusAgg[po.status]) statusAgg[po.status] = { count: 0, value: 0 };
        statusAgg[po.status].count++;
        statusAgg[po.status].value += po.grand_total || 0;
      });

      const statusConfig: Record<string, { label: string; color: string }> = {
        draft: { label: 'Draft', color: 'hsl(var(--muted-foreground))' },
        pending_verification: { label: 'Pending Verification', color: 'hsl(var(--chart-1))' },
        verified: { label: 'Verified', color: 'hsl(var(--chart-2))' },
        pending_authorization: { label: 'Pending Authorization', color: 'hsl(var(--chart-3))' },
        authorized: { label: 'Authorized', color: 'hsl(var(--chart-4))' },
        pending_approval: { label: 'Pending Approval', color: 'hsl(var(--chart-5))' },
        approved: { label: 'Approved', color: 'hsl(var(--success))' },
        rejected: { label: 'Rejected', color: 'hsl(var(--destructive))' },
      };

      return Object.entries(statusAgg).map(([status, { count, value }]) => ({
        status, count, value,
        label: statusConfig[status]?.label || status,
        color: statusConfig[status]?.color || 'hsl(var(--muted))',
      }));
    },
  });

  // Revenue forecast — needs estimated_value, separate query
  const { data: revenueForecast, isLoading: forecastLoading } = useQuery({
    queryKey: ['dashboard-revenue-forecast', activeVerticalId, assignedTo ?? null],
    enabled,
    staleTime: STALE,
    queryFn: async (): Promise<RevenueForecastData> => {
      const stageProbability: Record<string, { probability: number; label: string; color: string; order: number }> = {
        new: { probability: 10, label: 'New', color: 'hsl(var(--chart-1))', order: 1 },
        contacted: { probability: 20, label: 'Contacted', color: 'hsl(var(--chart-2))', order: 2 },
        engaged: { probability: 40, label: 'Engaged', color: 'hsl(var(--chart-3))', order: 3 },
        quoted: { probability: 60, label: 'Quoted', color: 'hsl(var(--chart-4))', order: 4 },
        negotiation: { probability: 80, label: 'Negotiation', color: 'hsl(var(--chart-5))', order: 5 },
      };

      let activeQ: any = supabase.from('leads').select('status, estimated_value')
        .in('status', ['new', 'contacted', 'engaged', 'quoted', 'negotiation'] as any)
        .not('estimated_value', 'is', null);
      let histQ: any = supabase.from('leads').select('status, won_at, lost_at')
        .in('status', ['won', 'lost']);
      if (activeVerticalId) {
        activeQ = activeQ.eq('vertical_id', activeVerticalId);
        histQ = histQ.eq('vertical_id', activeVerticalId);
      }
      if (assignedTo) {
        activeQ = activeQ.eq('assigned_to', assignedTo);
        histQ = histQ.eq('assigned_to', assignedTo);
      }
      const [{ data: activeLeads, error: leadsError }, { data: historicalLeads, error: histError }] = await Promise.all([
        activeQ, histQ,
      ]);

      if (leadsError) throw leadsError;
      if (histError) throw histError;

      const wonCount = historicalLeads?.filter(l => l.status === 'won').length || 0;
      const lostCount = historicalLeads?.filter(l => l.status === 'lost').length || 0;
      const totalClosed = wonCount + lostCount;
      const historicalWinRate = totalClosed > 0 ? (wonCount / totalClosed) * 100 : 25;

      const stageAgg: Record<string, { count: number; rawValue: number }> = {};
      activeLeads?.forEach((lead) => {
        if (!stageAgg[lead.status]) stageAgg[lead.status] = { count: 0, rawValue: 0 };
        stageAgg[lead.status].count++;
        stageAgg[lead.status].rawValue += lead.estimated_value || 0;
      });

      const pipelineByStage: PipelineStage[] = Object.entries(stageAgg)
        .map(([stage, { count, rawValue }]) => {
          const config = stageProbability[stage] || { probability: 10, label: stage, color: 'hsl(var(--muted))', order: 99 };
          return {
            stage, label: config.label, count, rawValue,
            probability: config.probability,
            weightedValue: rawValue * (config.probability / 100),
            color: config.color,
            order: config.order,
          };
        })
        .sort((a, b) => (a as any).order - (b as any).order)
        .map(({ order, ...rest }: any) => rest);

      const totalPipelineValue = pipelineByStage.reduce((sum, s) => sum + s.rawValue, 0);
      const weightedForecast = pipelineByStage.reduce((sum, s) => sum + s.weightedValue, 0);

      return { pipelineByStage, totalPipelineValue, weightedForecast, historicalWinRate };
    },
  });

  return {
    leadTrends: leadsData?.leadTrends,
    salesPipeline: leadsData?.salesPipeline,
    procurementStatus,
    leadSources: leadsData?.leadSources,
    revenueForecast,
    isLoading: leadsLoading || procurementLoading || forecastLoading,
  };
}

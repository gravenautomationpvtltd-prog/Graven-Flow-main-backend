import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DateRange {
  from?: Date;
  to?: Date;
}

export interface QuotationKPIs {
  totalQuotations: number;
  totalValue: number;
  conversionRate: number;
  avgDaysToConvert: number;
  avgQuotationValue: number;
  revisionRate: number;
  priceMatchedCount: number;
  priceMatchRate: number;
  matchedConvertedCount: number;
  matchedConversionRate: number;
  lostCount: number;
  pendingCount: number;
}

export interface StaffBreakdown {
  staffId: string;
  staffName: string;
  quotationCount: number;
  totalValue: number;
  convertedCount: number;
  conversionRate: number;
  avgDaysToConvert: number;
  topLossReason: string;
  priceMatchedCount: number;
  matchedConvertedCount: number;
  matchedConversionRate: number;
  lostCount: number;
  pendingCount: number;
}

export interface CustomerBreakdown {
  customerId: string;
  customerName: string;
  enquiryCount: number;
  quotationCount: number;
  convertedCount: number;
  conversionRate: number;
  totalQuotedValue: number;
  totalWonValue: number;
  lastQuotationDate: string;
  topWinReason: string;
  topLossReason: string;
  priceMatchedCount: number;
  matchedConvertedCount: number;
  matchedConversionRate: number;
  lostCount: number;
  pendingCount: number;
  // For staff filtering
  staffIds: string[];
}

export interface ReasonCount {
  reason: string;
  count: number;
  value: number;
}

export interface MonthlyVolume {
  month: string;
  created: number;
  converted: number;
  lost: number;
  priceMatched: number;
}

export interface ConversionTimeBucket {
  bucket: string;
  count: number;
}

export type StageFilter = 'all' | 'pending' | 'price_matched' | 'converted' | 'lost';

// Helper to batch .in() queries (Supabase limit ~300 per call)
async function batchedIn(
  table: string,
  column: string,
  ids: string[],
  select: string,
  extraFilters?: (q: any) => any
): Promise<any[]> {
  if (ids.length === 0) return [];
  const CHUNK = 300;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    chunks.push(ids.slice(i, i + CHUNK));
  }
  const results = await Promise.all(
    chunks.map(chunk => {
      let q = (supabase as any).from(table).select(select).in(column, chunk);
      if (extraFilters) q = extraFilters(q);
      return q;
    })
  );
  return results.flatMap(r => r.data || []);
}

// Helper to fetch all rows from a table using .range() pagination
async function fetchAllRows(
  table: string,
  select: string,
  filters?: (q: any) => any,
  pageSize = 1000
): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    let q = (supabase as any).from(table).select(select);
    if (filters) q = filters(q);
    q = q.range(from, from + pageSize - 1).order('id');
    const { data } = await q;
    const rows = data || [];
    allRows.push(...rows);
    hasMore = rows.length === pageSize;
    from += pageSize;
  }
  return allRows;
}

// Classify a quotation into a normalized stage
function classifyStage(q: any, leadMap: Map<string, any>): 'pending' | 'price_matched' | 'converted' | 'lost' {
  if (q.is_converted) return 'converted';
  const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
  if (lead?.status === 'lost') return 'lost';
  if (q.is_price_matched) return 'price_matched';
  return 'pending';
}

export function useQuotationAnalytics(dateRange: DateRange) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['quotation-analytics', dateRange.from?.toISOString(), dateRange.to?.toISOString(), session?.access_token],
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!activeSession) {
        throw new Error('No active session. Please log in again.');
      }

      // Phase 1: Fetch ALL quotations using pagination
      const quotations = await fetchAllRows(
        'quotations',
        'id, created_at, grand_total, status, created_by, customer_id, lead_id, is_converted, revision_number, deleted_at, is_price_matched',
        (q: any) => {
          let query = q.is('deleted_at', null).neq('status', 'draft');
          if (dateRange.from) query = query.gte('created_at', dateRange.from.toISOString());
          if (dateRange.to) query = query.lte('created_at', dateRange.to.toISOString());
          return query;
        }
      );

      // Phase 2: Extract unique IDs
      const customerIds = [...new Set(quotations.map(q => q.customer_id).filter(Boolean))] as string[];
      const leadIds = [...new Set(quotations.map(q => q.lead_id).filter(Boolean))] as string[];

      // Phase 3: Targeted fetches
      const [leads, customers, salesOrders, enquiryLeads] = await Promise.all([
        batchedIn('leads', 'id', leadIds, 'id, status, won_reason, lost_reason, updated_at, won_at, lost_at, customer_id, assigned_to, deleted_at', q => q.is('deleted_at', null)),
        batchedIn('customers', 'id', customerIds, 'id, company_name'),
        batchedIn('sales_orders', 'quotation_id', quotations.map(q => q.id), 'id, lead_id, quotation_id, order_value'),
        batchedIn('leads', 'customer_id', customerIds, 'id, customer_id', q => q.is('deleted_at', null)),
      ]);

      // Build lookup maps
      const leadMap = new Map(leads.map((l: any) => [l.id, l]));
      const customerMap = new Map(customers.map((c: any) => [c.id, c]));
      const orderByQuotation = new Map(salesOrders.map((o: any) => [o.quotation_id, o]));

      // Resolve responsible staff: lead.assigned_to > quotation.created_by
      const getStaffId = (q: any): string => {
        const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
        return lead?.assigned_to || q.created_by || 'unknown';
      };

      // Collect all unique staff IDs and fetch profiles
      const allStaffIds = [...new Set(quotations.map(q => getStaffId(q)).filter(id => id !== 'unknown'))] as string[];
      const profiles = await batchedIn('profiles', 'id', allStaffIds, 'id, full_name');
      const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

      // === KPIs ===
      const totalQuotations = quotations.length;
      const totalValue = quotations.reduce((sum, q) => sum + (q.grand_total || 0), 0);
      const convertedQuotations = quotations.filter(q => q.is_converted);
      const lostQuotations = quotations.filter(q => {
        const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
        return !q.is_converted && lead?.status === 'lost';
      });
      const priceMatchedQuotations = quotations.filter(q => q.is_price_matched);
      const pendingQuotations = quotations.filter(q => !q.is_converted && !q.is_price_matched && (() => {
        const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
        return lead?.status !== 'lost';
      })());

      const conversionRate = totalQuotations > 0 ? (convertedQuotations.length / totalQuotations) * 100 : 0;

      const conversionDays: number[] = [];
      convertedQuotations.forEach(q => {
        const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
        if (lead?.won_at) {
          const days = (new Date(lead.won_at).getTime() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24);
          if (days >= 0 && days < 365) conversionDays.push(days);
        }
      });
      const avgDaysToConvert = conversionDays.length > 0 ? conversionDays.reduce((a, b) => a + b, 0) / conversionDays.length : 0;
      const avgQuotationValue = totalQuotations > 0 ? totalValue / totalQuotations : 0;
      const revisedQuotations = quotations.filter(q => (q.revision_number || 0) > 0);
      const revisionRate = totalQuotations > 0 ? (revisedQuotations.length / totalQuotations) * 100 : 0;
      const priceMatchedCount = priceMatchedQuotations.length;
      const priceMatchRate = totalQuotations > 0 ? (priceMatchedCount / totalQuotations) * 100 : 0;
      const matchedConvertedCount = priceMatchedQuotations.filter(q => q.is_converted).length;
      const matchedConversionRate = priceMatchedCount > 0 ? (matchedConvertedCount / priceMatchedCount) * 100 : 0;

      const kpis: QuotationKPIs = {
        totalQuotations, totalValue, conversionRate, avgDaysToConvert, avgQuotationValue, revisionRate,
        priceMatchedCount, priceMatchRate, matchedConvertedCount, matchedConversionRate,
        lostCount: lostQuotations.length,
        pendingCount: pendingQuotations.length,
      };

      // === Staff Breakdown (keyed by lead assignee) ===
      const staffGroups = new Map<string, typeof quotations>();
      quotations.forEach(q => {
        const key = getStaffId(q);
        if (!staffGroups.has(key)) staffGroups.set(key, []);
        staffGroups.get(key)!.push(q);
      });

      const staffBreakdown: StaffBreakdown[] = Array.from(staffGroups.entries()).map(([staffId, qs]) => {
        const converted = qs.filter(q => q.is_converted);
        const lost = qs.filter(q => {
          const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
          return !q.is_converted && lead?.status === 'lost';
        });
        const priceMatched = qs.filter(q => q.is_price_matched);
        const pending = qs.filter(q => {
          const stage = classifyStage(q, leadMap);
          return stage === 'pending';
        });

        const lossReasons: Record<string, number> = {};
        qs.forEach(q => {
          const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
          if (lead?.lost_reason) lossReasons[lead.lost_reason] = (lossReasons[lead.lost_reason] || 0) + 1;
        });
        const topLossReason = Object.entries(lossReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

        const days: number[] = [];
        converted.forEach(q => {
          const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
          if (lead?.won_at) {
            const d = (new Date(lead.won_at).getTime() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24);
            if (d >= 0 && d < 365) days.push(d);
          }
        });

        const matchedConverted = priceMatched.filter(q => q.is_converted);

        return {
          staffId,
          staffName: profileMap.get(staffId)?.full_name || 'Unknown',
          quotationCount: qs.length,
          totalValue: qs.reduce((s, q) => s + (q.grand_total || 0), 0),
          convertedCount: converted.length,
          conversionRate: qs.length > 0 ? (converted.length / qs.length) * 100 : 0,
          avgDaysToConvert: days.length > 0 ? days.reduce((a, b) => a + b, 0) / days.length : 0,
          topLossReason,
          priceMatchedCount: priceMatched.length,
          matchedConvertedCount: matchedConverted.length,
          matchedConversionRate: priceMatched.length > 0 ? (matchedConverted.length / priceMatched.length) * 100 : 0,
          lostCount: lost.length,
          pendingCount: pending.length,
        };
      }).sort((a, b) => b.totalValue - a.totalValue);

      // === Customer Breakdown ===
      const custGroups = new Map<string, typeof quotations>();
      quotations.forEach(q => {
        const key = q.customer_id || 'unknown';
        if (!custGroups.has(key)) custGroups.set(key, []);
        custGroups.get(key)!.push(q);
      });

      const enquiryCountByCustomer = new Map<string, number>();
      enquiryLeads.forEach((l: any) => {
        if (l.customer_id) enquiryCountByCustomer.set(l.customer_id, (enquiryCountByCustomer.get(l.customer_id) || 0) + 1);
      });

      // Only include customers that have quotations (not ALL customers — that was causing noise)
      const customerBreakdown: CustomerBreakdown[] = Array.from(custGroups.entries())
        .filter(([id]) => id !== 'unknown')
        .map(([custId, qs]) => {
          const converted = qs.filter(q => q.is_converted);
          const lost = qs.filter(q => {
            const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
            return !q.is_converted && lead?.status === 'lost';
          });
          const priceMatched = qs.filter(q => q.is_price_matched);
          const pending = qs.filter(q => classifyStage(q, leadMap) === 'pending');
          const matchedConverted = priceMatched.filter(q => q.is_converted);

          const winReasons: Record<string, number> = {};
          const lossReasons: Record<string, number> = {};
          qs.forEach(q => {
            const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
            if (lead?.won_reason) winReasons[lead.won_reason] = (winReasons[lead.won_reason] || 0) + 1;
            if (lead?.lost_reason) lossReasons[lead.lost_reason] = (lossReasons[lead.lost_reason] || 0) + 1;
          });

          const wonValue = converted.reduce((s, q) => {
            const order = orderByQuotation.get(q.id);
            return s + (order?.order_value || q.grand_total || 0);
          }, 0);

          const sorted = [...qs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          // Collect all staff IDs for this customer's quotations
          const custStaffIds = [...new Set(qs.map(q => getStaffId(q)))];

          return {
            customerId: custId,
            customerName: customerMap.get(custId)?.company_name || 'Unknown',
            enquiryCount: enquiryCountByCustomer.get(custId) || 0,
            quotationCount: qs.length,
            convertedCount: converted.length,
            conversionRate: qs.length > 0 ? (converted.length / qs.length) * 100 : 0,
            totalQuotedValue: qs.reduce((s, q) => s + (q.grand_total || 0), 0),
            totalWonValue: wonValue,
            lastQuotationDate: sorted[0]?.created_at || '',
            topWinReason: Object.entries(winReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
            topLossReason: Object.entries(lossReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
            priceMatchedCount: priceMatched.length,
            matchedConvertedCount: matchedConverted.length,
            matchedConversionRate: priceMatched.length > 0 ? (matchedConverted.length / priceMatched.length) * 100 : 0,
            lostCount: lost.length,
            pendingCount: pending.length,
            staffIds: custStaffIds,
          };
        }).sort((a, b) => b.totalQuotedValue - a.totalQuotedValue);

      // === Win/Loss Reasons ===
      const winReasonsMap: Record<string, { count: number; value: number }> = {};
      const lossReasonsMap: Record<string, { count: number; value: number }> = {};
      quotations.forEach(q => {
        const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
        if (lead?.won_reason) {
          if (!winReasonsMap[lead.won_reason]) winReasonsMap[lead.won_reason] = { count: 0, value: 0 };
          winReasonsMap[lead.won_reason].count++;
          winReasonsMap[lead.won_reason].value += q.grand_total || 0;
        }
        if (lead?.lost_reason) {
          if (!lossReasonsMap[lead.lost_reason]) lossReasonsMap[lead.lost_reason] = { count: 0, value: 0 };
          lossReasonsMap[lead.lost_reason].count++;
          lossReasonsMap[lead.lost_reason].value += q.grand_total || 0;
        }
      });

      const winReasons: ReasonCount[] = Object.entries(winReasonsMap)
        .map(([reason, data]) => ({ reason, ...data }))
        .sort((a, b) => b.count - a.count);
      const lossReasons: ReasonCount[] = Object.entries(lossReasonsMap)
        .map(([reason, data]) => ({ reason, ...data }))
        .sort((a, b) => b.count - a.count);

      // === Monthly Volume ===
      const monthlyMap = new Map<string, { created: number; converted: number; lost: number; priceMatched: number }>();
      quotations.forEach(q => {
        const month = q.created_at.substring(0, 7);
        if (!monthlyMap.has(month)) monthlyMap.set(month, { created: 0, converted: 0, lost: 0, priceMatched: 0 });
        const entry = monthlyMap.get(month)!;
        entry.created++;
        if (q.is_converted) entry.converted++;
        if (q.is_price_matched) entry.priceMatched++;
        const lead = q.lead_id ? leadMap.get(q.lead_id) : null;
        if (lead?.status === 'lost') entry.lost++;
      });

      const monthlyVolume: MonthlyVolume[] = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // === Conversion Time Distribution ===
      const buckets = { '0-3 days': 0, '3-7 days': 0, '7-14 days': 0, '14-30 days': 0, '30+ days': 0 };
      conversionDays.forEach(d => {
        if (d <= 3) buckets['0-3 days']++;
        else if (d <= 7) buckets['3-7 days']++;
        else if (d <= 14) buckets['7-14 days']++;
        else if (d <= 30) buckets['14-30 days']++;
        else buckets['30+ days']++;
      });
      const conversionTimeBuckets: ConversionTimeBucket[] = Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));

      return { kpis, staffBreakdown, customerBreakdown, winReasons, lossReasons, monthlyVolume, conversionTimeBuckets };
    },
  });
}

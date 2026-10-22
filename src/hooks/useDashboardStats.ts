import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVertical } from '@/contexts/VerticalContext';
import { invalidateDashboardData } from '@/lib/dashboard-invalidation';
import { getStartOfTodayIST } from '@/lib/date-utils';
import { fetchUserAssociatedLeadIds } from '@/lib/lead-persistence';

export interface DashboardStats {
  totalLeads: number;
  newLeadsToday: number;
  totalRevenue: number;
  totalCustomers: number;
  pendingQuotationsValue: number;
  wonThisMonth: number;
}

export interface ProcurementStats {
  draftPOs: number;
  pendingPOs: number;
  lowStockAlerts: number;
  totalSuppliers: number;
  totalInventoryItems: number;
}

export interface PendingApprovals {
  pendingVerification: number;
  pendingAuthorization: number;
  pendingApproval: number;
}

interface DateRange {
  from?: Date;
  to?: Date;
}

export function useSalesStats(dateRange: DateRange, enabled: boolean, assignedTo?: string) {
  const { activeVerticalId } = useVertical();
  return useQuery({
    queryKey: ['dashboard-sales-stats', activeVerticalId, assignedTo ?? null, dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
    queryFn: async (): Promise<DashboardStats> => {
      // 1. High-speed single-roundtrip RPC (bypasses slow row-by-row RLS scans, returns in <500ms)
      try {
        const { data: rpcStats, error: rpcErr } = await (supabase as any).rpc('get_dashboard_sales_stats', {
          p_user_id: assignedTo || null,
          p_from: dateRange.from ? dateRange.from.toISOString() : null,
          p_to: dateRange.to ? dateRange.to.toISOString() : null,
          p_vertical_id: activeVerticalId || null,
        });

        if (!rpcErr && rpcStats) {
          return {
            totalLeads: Number(rpcStats.totalLeads) || 0,
            newLeadsToday: Number(rpcStats.newLeadsToday) || 0,
            totalRevenue: Number(rpcStats.totalRevenue) || 0,
            totalCustomers: Number(rpcStats.totalCustomers) || 0,
            pendingQuotationsValue: Number(rpcStats.pendingQuotationsValue) || 0,
            wonThisMonth: Number(rpcStats.wonThisMonth) || 0,
          };
        }
      } catch (err) {
        console.warn('[useSalesStats] RPC get_dashboard_sales_stats fallback to direct queries:', err);
      }

      // 2. Direct query fallback
      const today = getStartOfTodayIST();

      let leadsQuery: any = supabase.from('leads').select('id', { count: 'exact' }).limit(1).is('deleted_at', null);
      let customersQuery: any = supabase.from('customers').select('id', { count: 'exact' }).limit(1).is('deleted_at', null);
      let wonQuery: any = supabase.from('leads').select('id', { count: 'exact' }).limit(1).eq('status', 'won').is('deleted_at', null);
      let revenueQuery: any = supabase.from('sales_orders').select('payment_amount').eq('payment_status', 'received');
      let newTodayQuery: any = supabase.from('leads').select('id', { count: 'exact' }).limit(1).gte('created_at', today.toISOString()).is('deleted_at', null);
      const pageSize = 1000;
      let pendingCountQuery: any = supabase
        .from('quotations')
        .select('grand_total', { count: 'exact' })
        .is('deleted_at', null)
        .not('status', 'in', '("won","lost","draft")')
        .range(0, pageSize - 1);

      if (activeVerticalId) {
        leadsQuery = leadsQuery.eq('vertical_id', activeVerticalId);
        customersQuery = customersQuery.eq('vertical_id', activeVerticalId);
        wonQuery = wonQuery.eq('vertical_id', activeVerticalId);
        revenueQuery = revenueQuery.eq('vertical_id', activeVerticalId);
        newTodayQuery = newTodayQuery.eq('vertical_id', activeVerticalId);
        pendingCountQuery = pendingCountQuery.eq('vertical_id', activeVerticalId);
      }

      if (assignedTo) {
        leadsQuery = leadsQuery.eq('assigned_to', assignedTo);
        wonQuery = wonQuery.eq('assigned_to', assignedTo);
        newTodayQuery = newTodayQuery.eq('assigned_to', assignedTo);
        pendingCountQuery = pendingCountQuery.eq('created_by', assignedTo);
        customersQuery = customersQuery.eq('assigned_sales_id', assignedTo);
        revenueQuery = revenueQuery.eq('created_by', assignedTo);
      }

      if (dateRange.from) {
        leadsQuery = leadsQuery.gte('created_at', dateRange.from.toISOString());
        customersQuery = customersQuery.gte('created_at', dateRange.from.toISOString());
        revenueQuery = revenueQuery.gte('created_at', dateRange.from.toISOString());
        wonQuery = wonQuery.or(`won_at.gte.${dateRange.from.toISOString()},and(won_at.is.null,created_at.gte.${dateRange.from.toISOString()})`);
        pendingCountQuery = pendingCountQuery.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        leadsQuery = leadsQuery.lte('created_at', dateRange.to.toISOString());
        customersQuery = customersQuery.lte('created_at', dateRange.to.toISOString());
        revenueQuery = revenueQuery.lte('created_at', dateRange.to.toISOString());
        wonQuery = wonQuery.or(`won_at.lte.${dateRange.to.toISOString()},and(won_at.is.null,created_at.lte.${dateRange.to.toISOString()})`);
        pendingCountQuery = pendingCountQuery.lte('created_at', dateRange.to.toISOString());
      }

      // Execute in parallel for maximum speed
      const [leadsRes, newTodayRes, wonRes, customersRes, revenueRes, quotesFirstPageRes] = await Promise.all([
        leadsQuery,
        newTodayQuery,
        wonQuery,
        customersQuery,
        revenueQuery,
        pendingCountQuery,
      ]);

      const totalLeads = leadsRes.count;
      const newLeadsToday = newTodayRes.count;
      const wonThisMonth = wonRes.count;
      const totalCustomers = customersRes.count;
      const revenueData = revenueRes.data;

      const pendingQuotationsValue = (quotesFirstPageRes.data || []).reduce(
        (sum: number, q: any) => sum + (Number(q.grand_total) || 0),
        0
      );

      return {
        totalLeads: totalLeads || 0,
        newLeadsToday: newLeadsToday || 0,
        totalRevenue: (revenueData || []).reduce((sum: number, order: any) => sum + (Number(order.payment_amount) || 0), 0),
        totalCustomers: totalCustomers || 0,
        pendingQuotationsValue,
        wonThisMonth: wonThisMonth || 0,
      };
    },
  });
}

export function useProcurementStats(dateRange: DateRange, enabled: boolean) {
  const { activeVerticalId } = useVertical();
  return useQuery({
    queryKey: ['dashboard-procurement-stats', activeVerticalId, dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async (): Promise<ProcurementStats> => {
      // Consolidated PO status query (draft + pending statuses in a single roundtrip)
      let poQuery: any = supabase
        .from('purchase_orders')
        .select('status')
        .in('status', ['draft', 'pending_verification', 'pending_authorization', 'pending_approval'])
        .limit(500);

      if (activeVerticalId) poQuery = poQuery.eq('vertical_id', activeVerticalId);
      if (dateRange.from) poQuery = poQuery.gte('created_at', dateRange.from.toISOString());
      if (dateRange.to) poQuery = poQuery.lte('created_at', dateRange.to.toISOString());

      const [
        { data: poData },
        { count: totalSuppliers },
        { count: totalInventoryItems },
        { data: inventoryData },
      ] = await Promise.all([
        poQuery,
        supabase.from('suppliers').select('id', { count: 'exact' }).limit(1).eq('is_active', true),
        supabase.from('inventory').select('id', { count: 'exact' }).limit(1),
        // Only fetch items where a min_stock_level threshold is defined
        supabase.from('inventory').select('quantity, min_stock_level').not('min_stock_level', 'is', null).gt('min_stock_level', 0).limit(250),
      ]);

      const poRows = poData || [];
      const draftPOs = poRows.filter((r: any) => r.status === 'draft').length;
      const pendingPOs = poRows.filter((r: any) => r.status !== 'draft').length;

      return {
        draftPOs,
        pendingPOs,
        lowStockAlerts: inventoryData?.filter(item => item.quantity <= (item.min_stock_level || 0)).length || 0,
        totalSuppliers: totalSuppliers || 0,
        totalInventoryItems: totalInventoryItems || 0,
      };
    },
  });
}

export function usePendingApprovals(enabled: boolean) {
  const { activeVerticalId } = useVertical();
  return useQuery({
    queryKey: ['dashboard-pending-approvals', activeVerticalId],
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async (): Promise<PendingApprovals> => {
      // Consolidated single query across all three approval stages
      let q: any = supabase
        .from('purchase_orders')
        .select('status')
        .in('status', ['pending_verification', 'pending_authorization', 'pending_approval'])
        .limit(500);

      if (activeVerticalId) q = q.eq('vertical_id', activeVerticalId);

      const { data: poRows } = await q;
      const rows = poRows || [];

      return {
        pendingVerification: rows.filter((r: any) => r.status === 'pending_verification').length,
        pendingAuthorization: rows.filter((r: any) => r.status === 'pending_authorization').length,
        pendingApproval: rows.filter((r: any) => r.status === 'pending_approval').length,
      };
    },
  });
}

/** Targeted debounced realtime listener for live database changes with deduplicated invalidations */
export function useDashboardRealtime(options: {
  enableSales: boolean;
  enableProcurement: boolean;
  enableApprovals: boolean;
}) {
  const queryClient = useQueryClient();
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!options.enableSales && !options.enableProcurement && !options.enableApprovals) {
      return;
    }

    const scheduleInvalidations = (keys: string[]) => {
      keys.forEach((k) => pendingKeysRef.current.add(k));
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      // 1000ms buffer window: ensures rapid live updates while buffering bursts from sync workers
      batchTimerRef.current = setTimeout(() => {
        const keysToInvalidate = Array.from(pendingKeysRef.current);
        pendingKeysRef.current.clear();
        keysToInvalidate.forEach((k) => {
          queryClient.invalidateQueries({ queryKey: [k] });
        });
      }, 1000);
    };

    const channel = supabase
      .channel('dashboard-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () =>
        scheduleInvalidations(['dashboard-sales-stats', 'dashboard-leads-consolidated', 'user-quotation-performance', 'drilldown-quotations', 'spt-inbox'])
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_qualification' }, () =>
        scheduleInvalidations(['dashboard-sales-stats', 'dashboard-leads-consolidated', 'user-quotation-performance', 'drilldown-quotations', 'spt-inbox', 'lqt-inbox'])
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () =>
        scheduleInvalidations(['dashboard-sales-stats', 'dashboard-leads-consolidated', 'user-quotation-performance', 'drilldown-quotations'])
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, () =>
        scheduleInvalidations(['dashboard-sales-stats', 'accounts-stats', 'segment-revenue'])
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_payments' }, () =>
        scheduleInvalidations(['dashboard-sales-stats', 'accounts-stats', 'segment-revenue'])
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () =>
        scheduleInvalidations(['dashboard-procurement-stats', 'dashboard-pending-approvals'])
      )
      .subscribe();

    return () => {
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      pendingKeysRef.current.clear();
      supabase.removeChannel(channel);
    };
  }, [options.enableSales, options.enableProcurement, options.enableApprovals, queryClient]);
}

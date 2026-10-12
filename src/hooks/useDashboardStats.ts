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
    refetchOnMount: true,
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
      let draftPOsQuery: any = supabase.from('purchase_orders').select('id', { count: 'exact' }).limit(1).eq('status', 'draft');
      let pendingPOsQuery: any = supabase.from('purchase_orders').select('id', { count: 'exact' }).limit(1).in('status', ['pending_verification', 'pending_authorization', 'pending_approval']);

      if (activeVerticalId) {
        draftPOsQuery = draftPOsQuery.eq('vertical_id', activeVerticalId);
        pendingPOsQuery = pendingPOsQuery.eq('vertical_id', activeVerticalId);
      }
      if (dateRange.from) {
        draftPOsQuery = draftPOsQuery.gte('created_at', dateRange.from.toISOString());
        pendingPOsQuery = pendingPOsQuery.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        draftPOsQuery = draftPOsQuery.lte('created_at', dateRange.to.toISOString());
        pendingPOsQuery = pendingPOsQuery.lte('created_at', dateRange.to.toISOString());
      }

      const [
        { count: draftPOs },
        { count: pendingPOs },
        { count: totalSuppliers },
        { count: totalInventoryItems },
        { data: inventoryData },
      ] = await Promise.all([
        draftPOsQuery,
        pendingPOsQuery,
        supabase.from('suppliers').select('id', { count: 'exact' }).limit(1).eq('is_active', true),
        supabase.from('inventory').select('id', { count: 'exact' }).limit(1),
        supabase.from('inventory').select('quantity, min_stock_level').limit(500),
      ]);

      return {
        draftPOs: draftPOs || 0,
        pendingPOs: pendingPOs || 0,
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
      const buildQ = (status: string) => {
        let q: any = supabase.from('purchase_orders').select('id', { count: 'exact' }).limit(1).eq('status', status);
        if (activeVerticalId) q = q.eq('vertical_id', activeVerticalId);
        return q;
      };
      const [
        { count: pendingVerification },
        { count: pendingAuthorization },
        { count: pendingApprovalCount },
      ] = await Promise.all([
        buildQ('pending_verification'),
        buildQ('pending_authorization'),
        buildQ('pending_approval'),
      ]);

      return {
        pendingVerification: pendingVerification || 0,
        pendingAuthorization: pendingAuthorization || 0,
        pendingApproval: pendingApprovalCount || 0,
      };
    },
  });
}

/** Targeted debounced realtime listener for live database changes */
export function useDashboardRealtime(options: {
  enableSales: boolean;
  enableProcurement: boolean;
  enableApprovals: boolean;
}) {
  const queryClient = useQueryClient();
  const salesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const procTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!options.enableSales && !options.enableProcurement && !options.enableApprovals) {
      return;
    }

    const triggerSalesInvalidation = () => {
      if (salesTimerRef.current) clearTimeout(salesTimerRef.current);
      salesTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-sales-stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-leads-consolidated'] });
        queryClient.invalidateQueries({ queryKey: ['user-quotation-performance'] });
        queryClient.invalidateQueries({ queryKey: ['drilldown-quotations'] });
      }, 400);
    };

    const triggerProcInvalidation = () => {
      if (procTimerRef.current) clearTimeout(procTimerRef.current);
      procTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-procurement-stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-pending-approvals'] });
      }, 400);
    };

    const triggerFinanceInvalidation = () => {
      if (finTimerRef.current) clearTimeout(finTimerRef.current);
      finTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-sales-stats'] });
        queryClient.invalidateQueries({ queryKey: ['accounts-stats'] });
        queryClient.invalidateQueries({ queryKey: ['segment-revenue'] });
      }, 400);
    };

    const channel = supabase
      .channel('dashboard-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, triggerSalesInvalidation)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, triggerSalesInvalidation)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, triggerFinanceInvalidation)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_payments' }, triggerFinanceInvalidation)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, triggerProcInvalidation)
      .subscribe();

    return () => {
      if (salesTimerRef.current) clearTimeout(salesTimerRef.current);
      if (procTimerRef.current) clearTimeout(procTimerRef.current);
      if (finTimerRef.current) clearTimeout(finTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [options.enableSales, options.enableProcurement, options.enableApprovals, queryClient]);
}

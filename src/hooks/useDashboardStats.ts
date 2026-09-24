import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVertical } from '@/contexts/VerticalContext';

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
    staleTime: 30_000,
    queryFn: async (): Promise<DashboardStats> => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let leadsQuery: any = supabase.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null);
      let customersQuery: any = supabase.from('customers').select('*', { count: 'exact', head: true }).is('deleted_at', null);
      let pendingQuotationsQuery: any = supabase.from('quotations').select('grand_total').is('deleted_at', null).not('status', 'in', '("won","lost","draft")');
      let wonQuery: any = supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'won').is('deleted_at', null);
      let revenueQuery: any = supabase.from('sales_orders').select('payment_amount').eq('payment_status', 'received');
      let newTodayQuery: any = supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()).is('deleted_at', null);

      if (activeVerticalId) {
        leadsQuery = leadsQuery.eq('vertical_id', activeVerticalId);
        customersQuery = customersQuery.eq('vertical_id', activeVerticalId);
        pendingQuotationsQuery = pendingQuotationsQuery.eq('vertical_id', activeVerticalId);
        wonQuery = wonQuery.eq('vertical_id', activeVerticalId);
        revenueQuery = revenueQuery.eq('vertical_id', activeVerticalId);
        newTodayQuery = newTodayQuery.eq('vertical_id', activeVerticalId);
      }

      if (assignedTo) {
        leadsQuery = leadsQuery.eq('assigned_to', assignedTo);
        wonQuery = wonQuery.eq('assigned_to', assignedTo);
        newTodayQuery = newTodayQuery.eq('assigned_to', assignedTo);
        customersQuery = customersQuery.eq('assigned_sales_id', assignedTo);
        pendingQuotationsQuery = pendingQuotationsQuery.eq('created_by', assignedTo);
        revenueQuery = revenueQuery.eq('created_by', assignedTo);
      }

      if (dateRange.from) {
        leadsQuery = leadsQuery.gte('created_at', dateRange.from.toISOString());
        customersQuery = customersQuery.gte('created_at', dateRange.from.toISOString());
        pendingQuotationsQuery = pendingQuotationsQuery.gte('created_at', dateRange.from.toISOString());
        wonQuery = wonQuery.gte('won_at', dateRange.from.toISOString());
        revenueQuery = revenueQuery.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        leadsQuery = leadsQuery.lte('created_at', dateRange.to.toISOString());
        customersQuery = customersQuery.lte('created_at', dateRange.to.toISOString());
        pendingQuotationsQuery = pendingQuotationsQuery.lte('created_at', dateRange.to.toISOString());
        wonQuery = wonQuery.lte('won_at', dateRange.to.toISOString());
        revenueQuery = revenueQuery.lte('created_at', dateRange.to.toISOString());
      }

      const [
        { count: totalLeads },
        { count: newLeadsToday },
        { data: revenueData },
        { count: totalCustomers },
        { data: pendingQuotationsData },
        { count: wonThisMonth },
      ] = await Promise.all([
        leadsQuery,
        newTodayQuery,
        revenueQuery,
        customersQuery,
        pendingQuotationsQuery,
        wonQuery,
      ]);

      return {
        totalLeads: totalLeads || 0,
        newLeadsToday: newLeadsToday || 0,
        totalRevenue: (revenueData || []).reduce((sum: number, order: any) => sum + (order.payment_amount || 0), 0),
        totalCustomers: totalCustomers || 0,
        pendingQuotationsValue: (pendingQuotationsData || []).reduce((sum: number, q: any) => sum + (q.grand_total || 0), 0),
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
    staleTime: 30_000,
    queryFn: async (): Promise<ProcurementStats> => {
      let draftPOsQuery: any = supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'draft');
      let pendingPOsQuery: any = supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).in('status', ['pending_verification', 'pending_authorization', 'pending_approval']);

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
        { data: inventoryData },
      ] = await Promise.all([
        draftPOsQuery,
        pendingPOsQuery,
        supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('inventory').select('quantity, min_stock_level'),
      ]);

      return {
        draftPOs: draftPOs || 0,
        pendingPOs: pendingPOs || 0,
        lowStockAlerts: inventoryData?.filter(item => item.quantity <= (item.min_stock_level || 0)).length || 0,
        totalSuppliers: totalSuppliers || 0,
        totalInventoryItems: inventoryData?.length || 0,
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
    queryFn: async (): Promise<PendingApprovals> => {
      const buildQ = (status: string) => {
        let q: any = supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', status);
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

/** No-op — realtime removed to reduce WebSocket overhead. Dashboard data refreshes via staleTime. */
export function useDashboardRealtime(_options: {
  enableSales: boolean;
  enableProcurement: boolean;
  enableApprovals: boolean;
}) {
  // Intentionally empty — staleTime handles freshness
}

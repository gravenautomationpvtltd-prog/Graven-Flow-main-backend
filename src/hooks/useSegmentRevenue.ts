import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVertical } from '@/contexts/VerticalContext';
import type { DateRange } from './useDashboardAnalytics';

export interface SegmentRevenueData {
  segment: string;
  label: string;
  revenue: number;
  orderCount: number;
  customerCount: number;
  fill: string;
}

export function useSegmentRevenue(dateRange?: DateRange, assignedTo?: string, enabled: boolean = true) {
  const { activeVerticalId } = useVertical();
  return useQuery({
    queryKey: ['segment-revenue', activeVerticalId, assignedTo ?? null, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    enabled,
    queryFn: async (): Promise<SegmentRevenueData[]> => {
      let query = supabase
        .from('sales_orders')
        .select('order_value, customer_id, customers!inner(segment)')
        .not('status', 'eq', 'cancelled');

      if (activeVerticalId) query = query.eq('vertical_id', activeVerticalId);
      if (assignedTo) query = query.eq('created_by', assignedTo);
      if (dateRange?.from) query = query.gte('created_at', dateRange.from.toISOString());
      if (dateRange?.to) query = query.lte('created_at', dateRange.to.toISOString());

      const { data, error } = await query;
      if (error) throw error;

      const segmentMap: Record<string, { revenue: number; orderCount: number; customerIds: Set<string> }> = {
        platinum: { revenue: 0, orderCount: 0, customerIds: new Set() },
        gold: { revenue: 0, orderCount: 0, customerIds: new Set() },
        silver: { revenue: 0, orderCount: 0, customerIds: new Set() },
        bronze: { revenue: 0, orderCount: 0, customerIds: new Set() },
        inactive: { revenue: 0, orderCount: 0, customerIds: new Set() },
      };

      for (const order of data || []) {
        const segment = (order.customers as any)?.segment || 'bronze';
        const key = segment in segmentMap ? segment : 'bronze';
        segmentMap[key].revenue += order.order_value || 0;
        segmentMap[key].orderCount += 1;
        if (order.customer_id) {
          segmentMap[key].customerIds.add(order.customer_id);
        }
      }

      const colorMap: Record<string, string> = {
        platinum: 'hsl(270, 60%, 55%)',
        gold: 'hsl(45, 90%, 50%)',
        silver: 'hsl(220, 10%, 60%)',
        bronze: 'hsl(25, 70%, 55%)',
        inactive: 'hsl(0, 65%, 55%)',
      };

      const labelMap: Record<string, string> = {
        platinum: 'Platinum',
        gold: 'Gold',
        silver: 'Silver',
        bronze: 'Bronze',
        inactive: 'Inactive',
      };

      return Object.entries(segmentMap)
        .map(([segment, data]) => ({
          segment,
          label: labelMap[segment],
          revenue: data.revenue,
          orderCount: data.orderCount,
          customerCount: data.customerIds.size,
          fill: colorMap[segment],
        }))
        .filter(d => d.revenue > 0 || d.orderCount > 0);
    },
    staleTime: 5 * 60 * 1000,
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrderFrequencyRow {
  customerId: string;
  customerName: string;
  ownerName: string | null;
  totalOrders: number;
  totalValue: number;
  firstOrderDate: string;
  lastOrderDate: string;
  avgGapDays: number | null;
  daysSinceLastOrder: number;
  expectedNextOrderDate: string | null;
  status: 'on_track' | 'due_now' | 'overdue' | 'single_order';
}

const DAY = 1000 * 60 * 60 * 24;
const PAGE_SIZE = 1000;

export function useOrderFrequencyReport(sinceDate?: Date) {
  return useQuery({
    queryKey: ['reports', 'order-frequency', sinceDate?.toISOString() ?? 'all'],
    queryFn: async (): Promise<OrderFrequencyRow[]> => {
      const rows: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('sales_orders')
          .select(`
            id, customer_id, order_value, status, created_at,
            customer:customers(company_name, assigned_sales:profiles!customers_assigned_sales_id_fkey(full_name))
          `)
          .neq('status', 'cancelled')
          .not('customer_id', 'is', null)
          .order('created_at', { ascending: true })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        if (sinceDate) query = query.gte('created_at', sinceDate.toISOString());

        const { data, error } = await query;
        if (error) throw error;
        if (data?.length) rows.push(...data);
        hasMore = (data?.length ?? 0) === PAGE_SIZE;
        page++;
      }


      const byCustomer = new Map<string, any[]>();
      for (const row of rows) {
        const list = byCustomer.get(row.customer_id) ?? [];
        list.push(row);
        byCustomer.set(row.customer_id, list);
      }

      const now = Date.now();
      const result: OrderFrequencyRow[] = [];

      byCustomer.forEach((orders, customerId) => {
        orders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const first = orders[0];
        const last = orders[orders.length - 1];
        const totalOrders = orders.length;
        const totalValue = Math.round(orders.reduce((s, o) => s + (o.order_value || 0), 0));

        let avgGapDays: number | null = null;
        if (totalOrders >= 2) {
          const spanDays = (new Date(last.created_at).getTime() - new Date(first.created_at).getTime()) / DAY;
          avgGapDays = Math.max(1, Math.round(spanDays / (totalOrders - 1)));
        }

        const daysSinceLastOrder = Math.floor((now - new Date(last.created_at).getTime()) / DAY);
        const expectedNextOrderDate = avgGapDays
          ? new Date(new Date(last.created_at).getTime() + avgGapDays * DAY).toISOString()
          : null;

        let status: OrderFrequencyRow['status'] = 'single_order';
        if (avgGapDays) {
          if (daysSinceLastOrder > avgGapDays * 1.25) status = 'overdue';
          else if (daysSinceLastOrder >= avgGapDays) status = 'due_now';
          else status = 'on_track';
        }

        result.push({
          customerId,
          customerName: first.customer?.company_name || 'Unknown',
          ownerName: first.customer?.assigned_sales?.full_name || null,
          totalOrders,
          totalValue,
          firstOrderDate: first.created_at,
          lastOrderDate: last.created_at,
          avgGapDays,
          daysSinceLastOrder,
          expectedNextOrderDate,
          status,
        });
      });

      return result;
    },
  });
}

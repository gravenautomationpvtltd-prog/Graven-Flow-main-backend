import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CCTDecision } from '@/hooks/useCCTDecisions';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface CCTOrderGroup {
  sales_order_id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  order_value: number;
  received: number;
  pending: number;
  status: 'pending' | 'decided' | 'handed_off';
  order_status: string | null;
  payment_status: PaymentStatus;
  decisions: CCTDecision[];
  created_at: string;
}

export interface CCTInboxRange {
  from?: Date | null;
  to?: Date | null;
}

/**
 * Fetches all CCT decisions and groups them by sales_order_id.
 * Also pulls customer_payments to compute Received / Pending per order.
 */
export function useCCTOrderInbox(range?: CCTInboxRange) {
  const fromIso = range?.from ? range.from.toISOString() : null;
  const toIso = range?.to ? range.to.toISOString() : null;

  return useQuery({
    queryKey: ['cct-order-inbox', fromIso, toIso],
    queryFn: async (): Promise<CCTOrderGroup[]> => {
      let q = (supabase as any)
        .from('cct_sourcing_decisions')
        .select(`
          *,
          sales_orders:sales_order_id (
            order_number,
            customer_id,
            order_value,
            status,
            created_at,
            customers:customer_id ( company_name )
          )
        `)
        .order('created_at', { ascending: false });

      if (fromIso) q = q.gte('created_at', fromIso);
      if (toIso) q = q.lte('created_at', toIso);

      const { data: decisions, error } = await q;
      if (error) throw error;

      const list = (decisions || []) as CCTDecision[];
      const orderIds = Array.from(
        new Set(list.map((d) => d.sales_order_id).filter(Boolean) as string[])
      );

      let paymentsByOrder = new Map<string, number>();
      if (orderIds.length > 0) {
        const { data: payments } = await (supabase as any)
          .from('customer_payments')
          .select('sales_order_id, amount')
          .in('sales_order_id', orderIds);
        for (const p of payments || []) {
          if (!p.sales_order_id) continue;
          paymentsByOrder.set(
            p.sales_order_id,
            (paymentsByOrder.get(p.sales_order_id) || 0) + Number(p.amount || 0)
          );
        }
      }

      const groups = new Map<string, CCTOrderGroup>();
      for (const d of list) {
        if (!d.sales_order_id) continue;
        let g = groups.get(d.sales_order_id);
        if (!g) {
          const orderValue = Number(d.sales_orders?.order_value || 0);
          const received = paymentsByOrder.get(d.sales_order_id) || 0;
          const pending = Math.max(0, orderValue - received);
          const payment_status: PaymentStatus =
            received <= 0 ? 'unpaid' : received >= orderValue ? 'paid' : 'partial';
          g = {
            sales_order_id: d.sales_order_id,
            order_number: d.sales_orders?.order_number || '—',
            customer_id: d.sales_orders?.customer_id || null,
            customer_name: d.sales_orders?.customers?.company_name || '—',
            order_value: orderValue,
            received,
            pending,
            status: d.status,
            order_status: (d.sales_orders as any)?.status ?? null,
            payment_status,
            decisions: [],
            created_at: d.created_at,
          };
          groups.set(d.sales_order_id, g);
        }
        g.decisions.push(d);
        if (d.status === 'pending') g.status = 'pending';
        else if (g.status !== 'pending' && d.status === 'decided') g.status = 'decided';
      }

      return Array.from(groups.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });
}

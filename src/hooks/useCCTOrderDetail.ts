import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CCTOrderDetail {
  order: any;
  customer: any;
  payments: any[];
  documents: any[];
  decisions: any[];
  itemsById: Record<string, any>;
}

export function useCCTOrderDetail(salesOrderId: string | null) {
  return useQuery({
    enabled: !!salesOrderId,
    queryKey: ['cct-order-detail', salesOrderId],
    queryFn: async (): Promise<CCTOrderDetail> => {
      const { data: order, error: oerr } = await (supabase as any)
        .from('sales_orders')
        .select('*, customers:customer_id (*), quotations:quotation_id (id, quotation_number)')
        .eq('id', salesOrderId)
        .single();
      if (oerr) throw oerr;

      const [{ data: payments }, { data: documents }, { data: decisions }] = await Promise.all([
        (supabase as any)
          .from('customer_payments')
          .select('*')
          .eq('sales_order_id', salesOrderId)
          .order('payment_date', { ascending: false }),
        (supabase as any)
          .from('order_documents')
          .select('*')
          .eq('sales_order_id', salesOrderId)
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('cct_sourcing_decisions')
          .select('*')
          .eq('sales_order_id', salesOrderId)
          .order('created_at', { ascending: true }),
      ]);

      // Pull quotation_items if quotation present, for unit price reference
      let itemsById: Record<string, any> = {};
      if (order?.quotation_id) {
        const { data: qitems } = await (supabase as any)
          .from('quotation_items')
          .select('id, description, quantity, rate, amount, hsn_code, unit')
          .eq('quotation_id', order.quotation_id);
        for (const it of qitems || []) itemsById[it.id] = it;
      }

      return {
        order,
        customer: order?.customers || null,
        payments: payments || [],
        documents: documents || [],
        decisions: decisions || [],
        itemsById,
      };
    },
  });
}

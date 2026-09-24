import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AccountsCustomerSummary {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  totalPOs: number;
  totalValue: number;
  totalPaid: number;
  balance: number;
}

export interface POLedgerEntry {
  id: string;
  order_number: string;
  created_at: string;
  grand_total: number;
  status: string;
  customer_po_number: string | null;
  invoices: {
    id: string;
    invoice_number: string;
    invoice_date: string;
    grand_total: number;
    status: string;
  }[];
  dispatches: {
    id: string;
    dispatch_number: string;
    dispatch_date: string | null;
    status: string;
    courier_name: string | null;
    tracking_number: string | null;
  }[];
  payments: {
    id: string;
    amount: number;
    payment_date: string;
    payment_mode: string;
    transaction_reference: string | null;
    bank_name: string | null;
  }[];
  totalPaid: number;
  balance: number;
}

export function useAccountsCustomers(search: string) {
  return useQuery({
    queryKey: ['accounts-customers', search],
    queryFn: async (): Promise<AccountsCustomerSummary[]> => {
      // Get customers who have at least one sales order
      let query = supabase
        .from('customers')
        .select(`
          id, company_name, contact_person, phone, email, city,
          sales_orders(id, order_value, status)
        `)
        .not('sales_orders', 'is', null);

      if (search) {
        query = query.or(`company_name.ilike.%${search}%,contact_person.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data, error } = await query.order('company_name');
      if (error) throw error;

      // Also fetch all customer payments in one go
      const customerIds = (data || []).filter((c: any) => c.sales_orders?.length > 0).map((c: any) => c.id);
      if (customerIds.length === 0) return [];

      const { data: payments } = await supabase
        .from('customer_payments')
        .select('customer_id, amount')
        .in('customer_id', customerIds);

      const paymentsByCustomer: Record<string, number> = {};
      (payments || []).forEach((p: any) => {
        paymentsByCustomer[p.customer_id] = (paymentsByCustomer[p.customer_id] || 0) + p.amount;
      });

      return (data || [])
        .filter((c: any) => c.sales_orders?.length > 0)
        .map((c: any) => {
          const totalValue = (c.sales_orders || []).reduce((sum: number, so: any) => sum + (so.order_value || 0), 0);
          const totalPaid = paymentsByCustomer[c.id] || 0;
          return {
            id: c.id,
            company_name: c.company_name,
            contact_person: c.contact_person,
            phone: c.phone,
            email: c.email,
            city: c.city,
            totalPOs: c.sales_orders?.length || 0,
            totalValue,
            totalPaid,
            balance: totalValue - totalPaid,
          };
        })
        .sort((a: AccountsCustomerSummary, b: AccountsCustomerSummary) => b.balance - a.balance);
    },
  });
}

export function useCustomerPOLedger(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-po-ledger', customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<POLedgerEntry[]> => {
      const { data: orders, error } = await supabase
        .from('sales_orders')
        .select(`
          id, order_number, created_at, order_value, status, notes
        `)
        .eq('customer_id', customerId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!orders?.length) return [];

      const orderIds = orders.map(o => o.id);

      // Fetch invoices, dispatches, and payments for all orders in parallel
      const [invoicesRes, dispatchesRes, paymentsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, invoice_number, invoice_date, grand_total, status, sales_order_id')
          .in('sales_order_id', orderIds),
        supabase
          .from('dispatches')
          .select('id, dispatch_number, dispatch_date, status, courier_name, tracking_number, sales_order_id')
          .in('sales_order_id', orderIds),
        supabase
          .from('customer_payments')
          .select('id, amount, payment_date, payment_mode, transaction_reference, bank_name, sales_order_id')
          .in('sales_order_id', orderIds),
      ]);

      const invoicesByOrder: Record<string, any[]> = {};
      (invoicesRes.data || []).forEach(inv => {
        const key = inv.sales_order_id!;
        if (!invoicesByOrder[key]) invoicesByOrder[key] = [];
        invoicesByOrder[key].push(inv);
      });

      const dispatchesByOrder: Record<string, any[]> = {};
      (dispatchesRes.data || []).forEach(d => {
        const key = d.sales_order_id!;
        if (!dispatchesByOrder[key]) dispatchesByOrder[key] = [];
        dispatchesByOrder[key].push(d);
      });

      const paymentsByOrder: Record<string, any[]> = {};
      (paymentsRes.data || []).forEach(p => {
        const key = p.sales_order_id!;
        if (!paymentsByOrder[key]) paymentsByOrder[key] = [];
        paymentsByOrder[key].push(p);
      });

      return orders.map(order => {
        const payments = paymentsByOrder[order.id] || [];
        const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        return {
          id: order.id,
          order_number: order.order_number,
          created_at: order.created_at,
          grand_total: order.order_value || 0,
          status: order.status,
          customer_po_number: order.notes,
          invoices: invoicesByOrder[order.id] || [],
          dispatches: dispatchesByOrder[order.id] || [],
          payments,
          totalPaid,
          balance: (order.order_value || 0) - totalPaid,
        };
      });
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReceivableSummary {
  customerId: string;
  customerName: string;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate?: string | null;
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
}

export interface PayableSummary {
  supplierId: string;
  supplierName: string;
  totalPOValue: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate?: string | null;
}

export interface GSTSummary {
  outputCGST: number;
  outputSGST: number;
  outputIGST: number;
  inputCGST: number;
  inputSGST: number;
  inputIGST: number;
  netPayable: number;
}

export function useReceivablesSummary() {
  return useQuery({
    queryKey: ['accounts', 'receivables'],
    queryFn: async () => {
      // Get all sales orders with customer info (source of truth for receivables)
      const { data: orders, error: ordersError } = await supabase
        .from('sales_orders')
        .select(`
          id, customer_id, order_value, created_at,
          customer:customers(id, company_name)
        `)
        .neq('status', 'cancelled');

      if (ordersError) throw ordersError;

      // Get all customer payments
      const { data: payments, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('customer_id, amount, payment_date')
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Build payment totals per customer
      const paymentsByCustomer = new Map<string, { total: number; lastDate: string | null }>();
      payments?.forEach((p) => {
        const existing = paymentsByCustomer.get(p.customer_id);
        if (existing) {
          existing.total += p.amount;
        } else {
          paymentsByCustomer.set(p.customer_id, { total: p.amount, lastDate: p.payment_date });
        }
      });

      // Group by customer
      const customerMap = new Map<string, ReceivableSummary>();
      const now = new Date();

      orders?.forEach((order) => {
        if (!order.customer_id || !order.customer) return;
        
        const customerId = order.customer_id;
        const customerName = (order.customer as any).company_name;
        
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customerId,
            customerName,
            totalInvoiced: 0,
            totalPaid: 0,
            balance: 0,
            lastPaymentDate: paymentsByCustomer.get(customerId)?.lastDate || null,
            current: 0,
            days30: 0,
            days60: 0,
            days90Plus: 0,
          });
        }

        const entry = customerMap.get(customerId)!;
        entry.totalInvoiced += order.order_value || 0;
      });

      // Apply payments and calculate aging
      customerMap.forEach((entry) => {
        const paid = paymentsByCustomer.get(entry.customerId)?.total || 0;
        entry.totalPaid = paid;
        entry.balance = entry.totalInvoiced - paid;
      });

      // Calculate aging per order for customers with balance > 0
      orders?.forEach((order) => {
        if (!order.customer_id) return;
        const entry = customerMap.get(order.customer_id);
        if (!entry || entry.balance <= 0) return;

        // Proportional aging: distribute remaining balance across orders by age
        const orderValue = order.order_value || 0;
        if (orderValue <= 0) return;

        const orderDate = new Date(order.created_at);
        const daysDiff = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

        // Use order value as proxy for aging bucket (simplified)
        if (daysDiff <= 30) {
          entry.current += orderValue;
        } else if (daysDiff <= 60) {
          entry.days30 += orderValue;
        } else if (daysDiff <= 90) {
          entry.days60 += orderValue;
        } else {
          entry.days90Plus += orderValue;
        }
      });

      // Normalize aging buckets to not exceed balance
      customerMap.forEach((entry) => {
        const agingTotal = entry.current + entry.days30 + entry.days60 + entry.days90Plus;
        if (agingTotal > 0 && entry.balance > 0) {
          const ratio = entry.balance / agingTotal;
          entry.current = Math.round(entry.current * ratio);
          entry.days30 = Math.round(entry.days30 * ratio);
          entry.days60 = Math.round(entry.days60 * ratio);
          entry.days90Plus = Math.round(entry.days90Plus * ratio);
        }
      });

      return Array.from(customerMap.values()).filter(e => e.balance > 0);
    },
  });
}

export function usePayablesSummary() {
  return useQuery({
    queryKey: ['accounts', 'payables'],
    queryFn: async () => {
      // Get all purchase orders with supplier info
      const { data: pos, error: posError } = await supabase
        .from('purchase_orders')
        .select(`
          id, supplier_id, grand_total, status,
          supplier:suppliers(id, name)
        `)
        .in('status', ['approved', 'sent_to_supplier', 'partially_received', 'received']);

      if (posError) throw posError;

      // Get all supplier payments
      const { data: payments, error: paymentsError } = await supabase
        .from('supplier_payments')
        .select('supplier_id, amount, payment_date')
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Group by supplier
      const supplierMap = new Map<string, PayableSummary>();

      pos?.forEach((po) => {
        if (!po.supplier_id || !po.supplier) return;
        
        const supplierId = po.supplier_id;
        const supplierName = (po.supplier as any).name;
        
        if (!supplierMap.has(supplierId)) {
          supplierMap.set(supplierId, {
            supplierId,
            supplierName,
            totalPOValue: 0,
            totalPaid: 0,
            balance: 0,
            lastPaymentDate: null,
          });
        }

        const entry = supplierMap.get(supplierId)!;
        entry.totalPOValue += po.grand_total || 0;
      });

      // Add payments
      payments?.forEach((payment) => {
        const entry = supplierMap.get(payment.supplier_id);
        if (entry) {
          entry.totalPaid += payment.amount;
          if (!entry.lastPaymentDate) {
            entry.lastPaymentDate = payment.payment_date;
          }
        }
      });

      // Calculate balances
      supplierMap.forEach((entry) => {
        entry.balance = entry.totalPOValue - entry.totalPaid;
      });

      return Array.from(supplierMap.values()).filter(e => e.balance > 0);
    },
  });
}

export function useGSTSummary(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['accounts', 'gst', startDate, endDate],
    queryFn: async () => {
      // Get invoices (output tax)
      let invoiceQuery = supabase
        .from('invoices')
        .select('cgst_amount, sgst_amount, igst_amount')
        .neq('status', 'cancelled');

      if (startDate) {
        invoiceQuery = invoiceQuery.gte('invoice_date', startDate);
      }
      if (endDate) {
        invoiceQuery = invoiceQuery.lte('invoice_date', endDate);
      }

      const { data: invoices, error: invoicesError } = await invoiceQuery;
      if (invoicesError) throw invoicesError;

      // Get purchase orders (input tax)
      let poQuery = supabase
        .from('purchase_orders')
        .select('total_tax')
        .in('status', ['approved', 'sent_to_supplier', 'partially_received', 'received']);

      if (startDate) {
        poQuery = poQuery.gte('order_date', startDate);
      }
      if (endDate) {
        poQuery = poQuery.lte('order_date', endDate);
      }

      const { data: pos, error: posError } = await poQuery;
      if (posError) throw posError;

      const summary: GSTSummary = {
        outputCGST: 0,
        outputSGST: 0,
        outputIGST: 0,
        inputCGST: 0,
        inputSGST: 0,
        inputIGST: 0,
        netPayable: 0,
      };

      invoices?.forEach((inv) => {
        summary.outputCGST += inv.cgst_amount || 0;
        summary.outputSGST += inv.sgst_amount || 0;
        summary.outputIGST += inv.igst_amount || 0;
      });

      // Assuming 50-50 split for CGST/SGST for POs (simplified)
      const totalInputTax = pos?.reduce((sum, po) => sum + (po.total_tax || 0), 0) || 0;
      summary.inputCGST = totalInputTax / 2;
      summary.inputSGST = totalInputTax / 2;

      const totalOutput = summary.outputCGST + summary.outputSGST + summary.outputIGST;
      const totalInput = summary.inputCGST + summary.inputSGST + summary.inputIGST;
      summary.netPayable = totalOutput - totalInput;

      return summary;
    },
  });
}

export function useAccountsOverview() {
  return useQuery({
    queryKey: ['accounts', 'overview'],
    queryFn: async () => {
      // Get receivables
      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select('grand_total, amount_paid, invoice_date')
        .neq('status', 'cancelled');

      if (invError) throw invError;

      // Get payables
      const { data: pos, error: poError } = await supabase
        .from('purchase_orders')
        .select('grand_total')
        .in('status', ['approved', 'sent_to_supplier', 'partially_received', 'received']);

      if (poError) throw poError;

      const { data: supplierPayments, error: spError } = await supabase
        .from('supplier_payments')
        .select('amount');

      if (spError) throw spError;

      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      let totalReceivables = 0;
      let totalPayables = 0;
      let thisMonthRevenue = 0;
      let totalPaidToSuppliers = 0;

      invoices?.forEach((inv) => {
        const balance = (inv.grand_total || 0) - (inv.amount_paid || 0);
        totalReceivables += balance;
        
        const invDate = new Date(inv.invoice_date);
        if (invDate.getMonth() === thisMonth && invDate.getFullYear() === thisYear) {
          thisMonthRevenue += inv.amount_paid || 0;
        }
      });

      pos?.forEach((po) => {
        totalPayables += po.grand_total || 0;
      });

      supplierPayments?.forEach((sp) => {
        totalPaidToSuppliers += sp.amount || 0;
      });

      totalPayables -= totalPaidToSuppliers;

      return {
        totalReceivables,
        totalPayables,
        cashFlow: thisMonthRevenue,
        thisMonthRevenue,
      };
    },
  });
}

export function usePaymentsHistory(type?: 'received' | 'paid') {
  return useQuery({
    queryKey: ['accounts', 'payments', type],
    queryFn: async () => {
      const payments: Array<{
        id: string;
        type: 'received' | 'paid';
        amount: number;
        date: string;
        reference?: string | null;
        mode: string;
        partyName: string;
        partyId: string;
      }> = [];

      if (!type || type === 'received') {
        const { data: customerPayments, error: cpError } = await supabase
          .from('customer_payments')
          .select(`
            id, amount, payment_date, transaction_reference, payment_mode,
            customer:customers(id, company_name)
          `)
          .order('payment_date', { ascending: false });

        if (cpError) throw cpError;

        customerPayments?.forEach((cp) => {
          payments.push({
            id: cp.id,
            type: 'received',
            amount: cp.amount,
            date: cp.payment_date,
            reference: cp.transaction_reference,
            mode: cp.payment_mode,
            partyName: (cp.customer as any)?.company_name || 'Unknown',
            partyId: (cp.customer as any)?.id || '',
          });
        });
      }

      if (!type || type === 'paid') {
        const { data: supplierPayments, error: spError } = await supabase
          .from('supplier_payments')
          .select(`
            id, amount, payment_date, transaction_reference, payment_mode,
            supplier:suppliers(id, name)
          `)
          .order('payment_date', { ascending: false });

        if (spError) throw spError;

        supplierPayments?.forEach((sp) => {
          payments.push({
            id: sp.id,
            type: 'paid',
            amount: sp.amount,
            date: sp.payment_date,
            reference: sp.transaction_reference,
            mode: sp.payment_mode,
            partyName: (sp.supplier as any)?.name || 'Unknown',
            partyId: (sp.supplier as any)?.id || '',
          });
        });
      }

      // Sort by date
      payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return payments;
    },
  });
}

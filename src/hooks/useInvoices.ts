import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity-logger';
import { ensureFreshSession } from '@/utils/sessionGuard';

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  product_id?: string | null;
  description: string;
  hsn_code?: string | null;
  quantity: number;
  unit?: string | null;
  rate: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_percent?: number;
  tax_amount?: number;
  amount: number;
  sort_order?: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string | null;
  sales_order_id?: string | null;
  dispatch_id?: string | null;
  quotation_id?: string | null;
  customer_id: string;
  subtotal: number;
  total_tax: number;
  total_discount: number;
  grand_total: number;
  amount_paid: number;
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'cancelled' | 'overdue';
  place_of_supply?: string | null;
  is_igst: boolean;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  notes?: string | null;
  terms_conditions?: string | null;
  sent_at?: string | null;
  sent_by?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithDetails extends Invoice {
  customer?: {
    id: string;
    company_name: string;
    contact_person?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    gst_number?: string | null;
  } | null;
  sales_order?: {
    id: string;
    order_number: string;
  } | null;
  dispatch?: {
    id: string;
    dispatch_number: string;
  } | null;
  quotation?: {
    id: string;
    quotation_number: string;
  } | null;
  created_by_profile?: {
    id: string;
    full_name: string;
  } | null;
  items?: InvoiceItem[];
}

export function useInvoices(status?: string) {
  return useQuery({
    queryKey: ['invoices', status],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, company_name, contact_person, email, phone, address, city, state, pincode, gst_number),
          sales_order:sales_orders(id, order_number),
          dispatch:dispatches(id, dispatch_number),
          quotation:quotations!invoices_quotation_id_fkey(id, quotation_number),
          created_by_profile:profiles!invoices_created_by_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InvoiceWithDetails[];
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, company_name, contact_person, email, phone, address, city, state, pincode, gst_number),
          sales_order:sales_orders(id, order_number),
          dispatch:dispatches(id, dispatch_number),
          quotation:quotations!invoices_quotation_id_fkey(id, quotation_number),
          created_by_profile:profiles!invoices_created_by_fkey(id, full_name)
        `)
        .eq('id', id)
        .single();

      if (invoiceError) throw invoiceError;

      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', id)
        .order('sort_order', { ascending: true });

      if (itemsError) throw itemsError;

      return { ...invoice, items } as InvoiceWithDetails;
    },
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ invoice, items }: { invoice: Partial<Invoice>; items: InvoiceItem[] }) => {
      await ensureFreshSession();
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          ...invoice,
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      if (items.length > 0) {
        const itemsWithInvoiceId = items.map((item, index) => ({
          ...item,
          invoice_id: newInvoice.id,
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsWithInvoiceId);

        if (itemsError) throw itemsError;
      }

      return newInvoice;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created successfully');
      logActivity({
        action: 'create',
        entityType: 'invoice',
        entityId: data.id,
        entityName: data.invoice_number,
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, invoice, items }: { id: string; invoice: Partial<Invoice>; items?: InvoiceItem[] }) => {
      await ensureFreshSession();
      const { data: updatedInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .update(invoice)
        .eq('id', id)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      if (items) {
        // Delete existing items
        const { error: deleteError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', id);

        if (deleteError) throw deleteError;

        // Insert new items
        if (items.length > 0) {
          const itemsWithInvoiceId = items.map((item, index) => ({
            ...item,
            invoice_id: id,
            sort_order: index,
          }));

          const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(itemsWithInvoiceId);

          if (itemsError) throw itemsError;
        }
      }

      return updatedInvoice;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      toast.success('Invoice updated successfully');
      logActivity({
        action: 'update',
        entityType: 'invoice',
        entityId: data.id,
        entityName: data.invoice_number,
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update invoice: ${error.message}`);
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete invoice: ${error.message}`);
    },
  });
}

export function useRecordInvoicePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, amount }: { invoiceId: string; amount: number }) => {
      // Get current invoice
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('amount_paid, grand_total')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw fetchError;

      const newAmountPaid = (invoice.amount_paid || 0) + amount;
      const newStatus = newAmountPaid >= invoice.grand_total ? 'paid' : 'partial';

      const { data, error } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-unified-data'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-stats'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-aging'] });
      queryClient.invalidateQueries({ queryKey: ['top-outstanding-customers'] });
      queryClient.invalidateQueries({ queryKey: ['payment-collection-trend'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-drilldown'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Payment recorded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });
}

export function useInvoiceStats(dateRange?: { from: Date | undefined; to: Date | undefined }) {
  return useQuery({
    queryKey: ['invoice-stats', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('grand_total, amount_paid, status, invoice_date');

      if (dateRange?.from) {
        query = query.gte('invoice_date', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('invoice_date', dateRange.to.toISOString());
      }

      const { data: invoices, error } = await query;
      if (error) throw error;

      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const stats = {
        totalInvoiced: 0,
        pendingAmount: 0,
        overdueAmount: 0,
        thisMonthCollection: 0,
        totalCount: invoices?.length || 0,
        paidCount: 0,
        pendingCount: 0,
        overdueCount: 0,
      };

      invoices?.forEach((inv) => {
        stats.totalInvoiced += inv.grand_total || 0;
        const balance = (inv.grand_total || 0) - (inv.amount_paid || 0);

        if (inv.status === 'paid') {
          stats.paidCount++;
        } else if (inv.status === 'overdue') {
          stats.overdueAmount += balance;
          stats.overdueCount++;
        } else if (balance > 0) {
          stats.pendingAmount += balance;
          stats.pendingCount++;
        }

        const invDate = new Date(inv.invoice_date);
        if (invDate.getMonth() === thisMonth && invDate.getFullYear() === thisYear) {
          stats.thisMonthCollection += inv.amount_paid || 0;
        }
      });

      return stats;
    },
  });
}

export function useCreateInvoiceFromOrder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (salesOrderId: string) => {
      await ensureFreshSession();

      const { data: order, error: orderError } = await supabase
        .from('sales_orders')
        .select('id, order_number, customer_id, quotation_id, office_id, vertical_id, order_value, tenant_id')
        .eq('id', salesOrderId)
        .single();

      if (orderError) throw orderError;
      if (!order) throw new Error('Sales order not found');
      if (!order.customer_id) throw new Error('Sales order has no customer');

      // The invoice_number is generated automatically by the database trigger on insert.

      let subtotal = 0;
      let totalTax = 0;
      let totalDiscount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      const invoiceItems: InvoiceItem[] = [];

      if (order.quotation_id) {
        const { data: qItems, error: qItemsError } = await supabase
          .from('quotation_items')
          .select('*')
          .eq('quotation_id', order.quotation_id)
          .order('sort_order', { ascending: true });

        if (qItemsError) throw qItemsError;

        qItems?.forEach((item: any, index: number) => {
          const quantity = Number(item.quantity) || 0;
          const rate = Number(item.rate) || 0;
          const discountAmount = Number(item.discount_amount) || 0;
          const taxPercent = Number(item.tax_percent) || 0;
          const taxableValue = (quantity * rate) - discountAmount;
          const taxAmount = (taxableValue * taxPercent) / 100;

          subtotal += taxableValue;
          totalTax += taxAmount;
          totalDiscount += discountAmount;

          // Default intra-state split; IGST flag can be updated later
          cgstAmount += taxAmount / 2;
          sgstAmount += taxAmount / 2;

          invoiceItems.push({
            product_id: item.product_id,
            description: item.product_description || item.description || '',
            hsn_code: item.hsn_code,
            quantity,
            unit: item.unit,
            rate,
            discount_percent: Number(item.discount_percent) || 0,
            discount_amount: discountAmount,
            tax_percent: taxPercent,
            tax_amount: taxAmount,
            amount: taxableValue + taxAmount,
            sort_order: index,
          });
        });
      }

      // Fallback for orders without quotation line items: single placeholder line using order value
      if (invoiceItems.length === 0) {
        const value = Number(order.order_value) || 0;
        subtotal = value;
        invoiceItems.push({
          description: 'As per sales order',
          quantity: 1,
          unit: 'Nos',
          rate: value,
          discount_percent: 0,
          discount_amount: 0,
          tax_percent: 0,
          tax_amount: 0,
          amount: value,
          sort_order: 0,
        });
      }

      const grandTotal = subtotal + totalTax;
      const invoiceDate = new Date().toISOString().split('T')[0];

      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_date: invoiceDate,
          due_date: invoiceDate,
          sales_order_id: order.id,
          quotation_id: order.quotation_id,
          customer_id: order.customer_id,
          office_id: order.office_id,
          vertical_id: order.vertical_id,
          subtotal,
          total_tax: totalTax,
          total_discount: totalDiscount,
          grand_total: grandTotal,
          amount_paid: 0,
          status: 'draft',
          is_igst: false,
          cgst_amount: cgstAmount,
          sgst_amount: sgstAmount,
          igst_amount: igstAmount,
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      if (invoiceItems.length > 0) {
        const itemsWithInvoiceId = invoiceItems.map((item, index) => ({
          ...item,
          invoice_id: newInvoice.id,
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsWithInvoiceId as any);

        if (itemsError) throw itemsError;
      }

      return newInvoice;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['finance-orders'] });
      toast.success('Invoice drafted successfully');
      logActivity({
        action: 'create',
        entityType: 'invoice',
        entityId: data.id,
        entityName: data.invoice_number,
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to draft invoice: ${error.message}`);
    },
  });
}

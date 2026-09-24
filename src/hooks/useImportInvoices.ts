import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureFreshSession } from '@/utils/sessionGuard';
import { requireTenantId } from '@/utils/tenantUtils';
import { toast } from 'sonner';

export interface ImportInvoiceItem {
  id?: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  total: number;
  sort_order: number;
}

export interface CreateImportInvoiceData {
  invoice_number: string;
  supplier_id: string;
  po_id?: string | null;
  invoice_date: string;
  due_date?: string | null;
  currency: string;
  exchange_rate: number;
  subtotal: number;
  shipping_charges: number;
  insurance: number;
  customs_duty: number;
  igst_amount: number;
  other_charges: number;
  grand_total: number;
  grand_total_inr: number;
  status: string;
  bill_of_entry_number?: string | null;
  awb_bl_number?: string | null;
  notes?: string | null;
  items: ImportInvoiceItem[];
}

export function useImportInvoices() {
  return useQuery({
    queryKey: ['import-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_invoices')
        .select('*, suppliers:supplier_id(company_name), purchase_orders:po_id(po_number)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useImportInvoiceStats() {
  return useQuery({
    queryKey: ['import-invoice-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_invoices')
        .select('grand_total_inr, amount_paid, status');
      if (error) throw error;
      const totalINR = data.reduce((s, r) => s + Number(r.grand_total_inr || 0), 0);
      const totalPaid = data.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
      const pending = totalINR - totalPaid;
      const count = data.length;
      return { totalINR, totalPaid, pending, count };
    },
  });
}

export function useImportInvoiceItems(invoiceId: string | null) {
  return useQuery({
    queryKey: ['import-invoice-items', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_invoice_items')
        .select('*, products:product_id(name)')
        .eq('import_invoice_id', invoiceId!)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateImportInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateImportInvoiceData) => {
      await ensureFreshSession();
      const tenantId = await requireTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { items, ...invoiceData } = input;
      const { data: invoice, error } = await supabase
        .from('import_invoices')
        .insert({
          ...invoiceData,
          internal_ref: 'TEMP', // trigger will overwrite
          tenant_id: tenantId,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      if (items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('import_invoice_items')
          .insert(items.map((it, i) => ({
            import_invoice_id: invoice.id,
            product_id: it.product_id || null,
            description: it.description,
            quantity: it.quantity,
            unit: it.unit || null,
            unit_price: it.unit_price,
            total: it.total,
            sort_order: i,
          })));
        if (itemsErr) throw itemsErr;
      }
      return invoice;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-invoices'] });
      qc.invalidateQueries({ queryKey: ['import-invoice-stats'] });
      toast.success('Import invoice created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateImportInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await ensureFreshSession();
      const { error } = await supabase
        .from('import_invoices')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-invoices'] });
      qc.invalidateQueries({ queryKey: ['import-invoice-stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRecordImportPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      await ensureFreshSession();
      // Get current amount_paid
      const { data: inv, error: fetchErr } = await supabase
        .from('import_invoices')
        .select('amount_paid, grand_total_inr')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const newPaid = Number(inv.amount_paid || 0) + amount;
      const newStatus = newPaid >= Number(inv.grand_total_inr) ? 'paid' : 'partial';

      const { error } = await supabase
        .from('import_invoices')
        .update({ amount_paid: newPaid, status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-invoices'] });
      qc.invalidateQueries({ queryKey: ['import-invoice-stats'] });
      toast.success('Payment recorded');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

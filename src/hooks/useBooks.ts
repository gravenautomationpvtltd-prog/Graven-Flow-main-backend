import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { requireTenantId } from '@/utils/tenantUtils';
import { toast } from 'sonner';
import type { LedgerLine } from '@/lib/financial-statements';

const PAGE = 1000;

/** All ledger lines in a date range, with their account attached. */
export function useLedgerLines(from: string, to: string) {
  return useQuery({
    queryKey: ['ledger-lines', from, to],
    queryFn: async (): Promise<(LedgerLine & {
      id: string;
      narration: string | null;
      source_type: string;
      source_id: string | null;
      source_ref: string | null;
    })[]> => {
      const rows: any[] = [];
      for (let page = 0; ; page += 1) {
        const { data, error } = await supabase
          .from('ledger_entries')
          .select(
            'id, entry_date, account_id, debit, credit, narration, source_type, source_id, source_ref, account:chart_of_accounts(code, name, account_type, statement_group, opening_balance)',
          )
          .gte('entry_date', from)
          .lte('entry_date', to)
          .order('entry_date', { ascending: true })
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return rows;
    },
    enabled: !!from && !!to,
  });
}

export function useChartOfAccounts() {
  return useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .order('code', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSeedAccounting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const tenantId = await requireTenantId();
      const { data, error } = await supabase.rpc('backpost_accounting', { _tenant: tenantId });
      if (error) throw error;
      return data as Record<string, number>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ledger-lines'] });
      qc.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      toast.success(
        `Books rebuilt from ${data?.invoices ?? 0} invoices, ${data?.customer_payments ?? 0} receipts and ${data?.supplier_payments ?? 0} supplier payments`,
      );
    },
    onError: (e: any) => toast.error(e.message ?? 'Could not rebuild the books'),
  });
}

/* ------------------------------ purchase bills ----------------------------- */

export function usePurchaseBills(from?: string, to?: string) {
  return useQuery({
    queryKey: ['purchase-bills', from, to],
    queryFn: async () => {
      let q = supabase
        .from('purchase_bills')
        .select('*, supplier:suppliers(name, gst_number), items:purchase_bill_items(*)')
        .order('bill_date', { ascending: false });
      if (from) q = q.gte('bill_date', from);
      if (to) q = q.lte('bill_date', to);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface PurchaseBillItemInput {
  description: string;
  hsn_code?: string | null;
  quantity: number;
  unit?: string | null;
  rate: number;
  tax_percent: number;
}

export function useSavePurchaseBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      bill,
      items,
    }: {
      id?: string;
      bill: Record<string, any>;
      items: PurchaseBillItemInput[];
    }) => {
      const tenantId = await requireTenantId();
      const { data: auth } = await supabase.auth.getUser();

      const priced = items.map((it, i) => {
        const amount = (Number(it.quantity) || 0) * (Number(it.rate) || 0);
        const tax = (amount * (Number(it.tax_percent) || 0)) / 100;
        return {
          description: it.description,
          hsn_code: it.hsn_code || null,
          quantity: Number(it.quantity) || 0,
          unit: it.unit || 'Nos',
          rate: Number(it.rate) || 0,
          tax_percent: Number(it.tax_percent) || 0,
          tax_amount: Math.round(tax * 100) / 100,
          amount: Math.round((amount + tax) * 100) / 100,
          sort_order: i,
        };
      });

      const subtotal = priced.reduce((s, i) => s + i.quantity * i.rate, 0);
      const totalTax = priced.reduce((s, i) => s + i.tax_amount, 0);
      const other = Number(bill.other_charges) || 0;
      const isIgst = !!bill.is_igst;

      const payload = {
        ...bill,
        tenant_id: tenantId,
        other_charges: other,
        subtotal: Math.round(subtotal * 100) / 100,
        total_tax: Math.round(totalTax * 100) / 100,
        cgst_amount: isIgst ? 0 : Math.round((totalTax / 2) * 100) / 100,
        sgst_amount: isIgst ? 0 : Math.round((totalTax / 2) * 100) / 100,
        igst_amount: isIgst ? Math.round(totalTax * 100) / 100 : 0,
        grand_total: Math.round((subtotal + totalTax + other) * 100) / 100,
        created_by: bill.created_by ?? auth.user?.id ?? null,
      };

      let billId = id;
      if (id) {
        const { error } = await supabase.from('purchase_bills').update(payload).eq('id', id);
        if (error) throw error;
        await supabase.from('purchase_bill_items').delete().eq('bill_id', id);
      } else {
        const { data, error } = await supabase.from('purchase_bills').insert(payload as any).select('id').single();
        if (error) throw error;
        billId = data.id;
      }

      if (priced.length) {
        const { error } = await supabase
          .from('purchase_bill_items')
          .insert(priced.map((p) => ({ ...p, bill_id: billId! })));
        if (error) throw error;
      }

      // Re-save so the ledger trigger sees the final totals
      await supabase.from('purchase_bills').update({ updated_at: new Date().toISOString() }).eq('id', billId!);
      return billId!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-bills'] });
      qc.invalidateQueries({ queryKey: ['ledger-lines'] });
      qc.invalidateQueries({ queryKey: ['gst-filing'] });
      toast.success('Purchase bill saved');
    },
    onError: (e: any) => toast.error(e.message ?? 'Could not save the purchase bill'),
  });
}

export function useDeletePurchaseBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('purchase_bills').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-bills'] });
      qc.invalidateQueries({ queryKey: ['ledger-lines'] });
      toast.success('Purchase bill deleted');
    },
    onError: (e: any) => toast.error(e.message ?? 'Could not delete the bill'),
  });
}

/* --------------------------------- expenses -------------------------------- */

export function useExpenses(from?: string, to?: string) {
  return useQuery({
    queryKey: ['expenses', from, to],
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('*, account:chart_of_accounts(code, name)')
        .order('expense_date', { ascending: false });
      if (from) q = q.gte('expense_date', from);
      if (to) q = q.lte('expense_date', to);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, expense }: { id?: string; expense: Record<string, any> }) => {
      const tenantId = await requireTenantId();
      const { data: auth } = await supabase.auth.getUser();
      const amount = Number(expense.amount) || 0;
      const cgst = Number(expense.cgst_amount) || 0;
      const sgst = Number(expense.sgst_amount) || 0;
      const igst = Number(expense.igst_amount) || 0;
      const payload = {
        ...expense,
        tenant_id: tenantId,
        amount,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        total_amount: Math.round((amount + cgst + sgst + igst) * 100) / 100,
        created_by: expense.created_by ?? auth.user?.id ?? null,
      };
      if (id) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from('expenses').insert(payload).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['ledger-lines'] });
      toast.success('Expense saved');
    },
    onError: (e: any) => toast.error(e.message ?? 'Could not save the expense'),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['ledger-lines'] });
      toast.success('Expense deleted');
    },
    onError: (e: any) => toast.error(e.message ?? 'Could not delete the expense'),
  });
}

/* ------------------------------- fixed assets ------------------------------ */

export function useFixedAssets() {
  return useQuery({
    queryKey: ['fixed-assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixed_assets')
        .select('*')
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveFixedAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, asset }: { id?: string; asset: Record<string, any> }) => {
      const tenantId = await requireTenantId();
      const { data: auth } = await supabase.auth.getUser();
      const payload = { ...asset, tenant_id: tenantId, created_by: asset.created_by ?? auth.user?.id ?? null };
      if (id) {
        const { error } = await supabase.from('fixed_assets').update(payload).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from('fixed_assets').insert(payload as any).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-assets'] });
      qc.invalidateQueries({ queryKey: ['ledger-lines'] });
      toast.success('Asset saved');
    },
    onError: (e: any) => toast.error(e.message ?? 'Could not save the asset'),
  });
}

export function useDeleteFixedAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fixed_assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-assets'] });
      qc.invalidateQueries({ queryKey: ['ledger-lines'] });
      toast.success('Asset deleted');
    },
    onError: (e: any) => toast.error(e.message ?? 'Could not delete the asset'),
  });
}

/* ------------------------------ supplier list ------------------------------ */

export function useSupplierOptions() {
  return useQuery({
    queryKey: ['supplier-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select("id, name, gst_number")
        .order("name", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

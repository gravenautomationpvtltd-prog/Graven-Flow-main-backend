import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  gstinStateCode,
  type GstrPeriod,
  type InwardRow,
  type OutwardRow,
} from '@/lib/gst-returns';

export interface GstFilingData {
  outward: OutwardRow[];
  inward: InwardRow[];
  ewayBills: {
    id: string;
    number: string;
    date: string;
    party: string;
    dispatchNumber: string | null;
    status: string | null;
  }[];
}

export function useGstFiling(period: GstrPeriod) {
  return useQuery({
    queryKey: ['gst-filing', period.from, period.to],
    queryFn: async (): Promise<GstFilingData> => {
      const [invoicesRes, billsRes, dispatchRes] = await Promise.all([
        supabase
          .from('invoices')
          .select(
            'id, invoice_number, invoice_date, grand_total, total_tax, cgst_amount, sgst_amount, igst_amount, is_igst, place_of_supply, status, customer:customers(company_name, gst_number, state), items:invoice_items(description, hsn_code, quantity, unit, rate, tax_percent, tax_amount, amount)',
          )
          .gte('invoice_date', period.from)
          .lte('invoice_date', period.to)
          .order('invoice_date', { ascending: true }),
        supabase
          .from('purchase_bills')
          .select('*, supplier:suppliers(name, gst_number)')
          .gte('bill_date', period.from)
          .lte('bill_date', period.to)
          .order('bill_date', { ascending: true }),
        supabase
          .from('dispatches')
          .select('id, dispatch_number, eway_bill_number, eway_bill_status, dispatch_date, created_at')
          .not('eway_bill_number', 'is', null)
          .gte('dispatch_date', period.from)
          .lte('dispatch_date', period.to),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (billsRes.error) throw billsRes.error;

      const outward: OutwardRow[] = (invoicesRes.data ?? [])
        .filter((inv: any) => (inv.status ?? '') !== 'cancelled')
        .map((inv: any) => {
          const gstin = inv.customer?.gst_number?.trim() || null;
          const stateFromGstin = gstinStateCode(gstin);
          const posCode = (inv.place_of_supply ?? '').match(/^\d{2}/)?.[0] ?? stateFromGstin;
          const items = (inv.items ?? []).map((it: any) => ({
            description: it.description ?? '',
            hsn: it.hsn_code ?? null,
            quantity: Number(it.quantity) || 0,
            unit: it.unit ?? 'NOS',
            taxable: (Number(it.quantity) || 0) * (Number(it.rate) || 0),
            taxPercent: Number(it.tax_percent) || 0,
            tax: Number(it.tax_amount) || 0,
          }));
          return {
            invoiceId: inv.id,
            invoiceNumber: inv.invoice_number,
            invoiceDate: inv.invoice_date,
            customerName: inv.customer?.company_name ?? 'Unknown',
            customerGstin: gstin,
            placeOfSupply: inv.place_of_supply ?? inv.customer?.state ?? null,
            stateCode: posCode ?? null,
            isIgst: !!inv.is_igst || Number(inv.igst_amount) > 0,
            taxable: (Number(inv.grand_total) || 0) - (Number(inv.total_tax) || 0),
            cgst: Number(inv.cgst_amount) || 0,
            sgst: Number(inv.sgst_amount) || 0,
            igst: Number(inv.igst_amount) || 0,
            total: Number(inv.grand_total) || 0,
            items,
          };
        });

      const inward: InwardRow[] = (billsRes.data ?? []).map((b: any) => ({
        billId: b.id,
        billNumber: b.bill_number,
        billDate: b.bill_date,
        supplierName: b.supplier?.name ?? b.supplier_name ?? 'Unknown',
        supplierGstin: b.supplier_gstin ?? b.supplier?.gst_number ?? null,
        taxable: Number(b.subtotal) || 0,
        cgst: Number(b.cgst_amount) || 0,
        sgst: Number(b.sgst_amount) || 0,
        igst: Number(b.igst_amount) || 0,
        total: Number(b.grand_total) || 0,
        itcEligible: b.itc_eligible !== false,
      }));

      const ewayBills = (dispatchRes.data ?? []).map((d: any) => ({
        id: d.id,
        number: d.eway_bill_number,
        date: d.dispatch_date ?? d.created_at,
        party: '',
        dispatchNumber: d.dispatch_number ?? null,
        status: d.eway_bill_status ?? null,
      }));

      return { outward, inward, ewayBills };
    },
    enabled: !!period.from,
  });
}

export function useCompanyGstin() {
  return useQuery({
    queryKey: ['company-gstin'],
    queryFn: async () => {
      const { data } = await supabase.from('gst_api_settings').select('gstin').limit(1).maybeSingle();
      if (data?.gstin) return data.gstin as string;
      const { data: tenant } = await supabase.from('tenants').select('gst_number').limit(1).maybeSingle();
      return (tenant?.gst_number as string) ?? '';
    },
  });
}

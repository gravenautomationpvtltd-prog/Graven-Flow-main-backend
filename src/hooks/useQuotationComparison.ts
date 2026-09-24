import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { QuotationItem } from '@/hooks/useQuotations';
import type { ComparisonInputRow, RmbReference } from '@/lib/comparison-sheet';

const norm = (s?: string | null) => (s || '').trim().toUpperCase();

/**
 * Fetches the catalog list prices + latest approved bulk-price (RMB) rows
 * for the given quotation lines. Only ever called for permitted users.
 */
export function useQuotationComparison(
  quotationId: string | undefined,
  items: QuotationItem[] | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['quotation-comparison', quotationId, (items || []).length],
    enabled: Boolean(enabled && quotationId && items && items.length),
    staleTime: 60_000,
    queryFn: async (): Promise<ComparisonInputRow[]> => {
      const lines = items || [];
      const productIds = Array.from(
        new Set(lines.map((i) => i.product_id).filter(Boolean) as string[]),
      );

      const productMap = new Map<string, any>();
      if (productIds.length) {
        const { data } = await supabase
          .from('products')
          .select('id, name, model_number, hsn_code, list_price, list_price_source, min_margin_pct')
          .in('id', productIds);
        (data || []).forEach((p: any) => productMap.set(p.id, p));
      }

      const models = Array.from(
        new Set(
          lines
            .map((i) => norm(i.model_number) || norm(productMap.get(i.product_id || '')?.model_number))
            .filter(Boolean),
        ),
      );
      const hsns = Array.from(new Set(lines.map((i) => norm(i.hsn_code)).filter(Boolean)));

      const rmbByModel = new Map<string, RmbReference>();
      const rmbByHsn = new Map<string, RmbReference>();
      const cols =
        'model_number, hsn_code, rmb_price, weight_kg, final_inr_unit, rmb_usd_rate, usd_inr_rate, freight_usd_per_kg, insurance_pct, cc_pct, duty_pct, expense_pct, margin_pct, negotiation_pct, approved_at, created_at';

      if (models.length) {
        const { data } = await supabase
          .from('price_submission_items')
          .select(cols)
          .eq('approved', true)
          .in('model_number', models)
          .order('approved_at', { ascending: false })
          .limit(2000);
        // First occurrence wins (latest approved)
        (data || []).forEach((r: any) => {
          const k = norm(r.model_number);
          if (k && !rmbByModel.has(k)) rmbByModel.set(k, r as RmbReference);
        });
      }

      if (hsns.length) {
        const { data } = await supabase
          .from('price_submission_items')
          .select(cols)
          .eq('approved', true)
          .in('hsn_code', hsns)
          .order('approved_at', { ascending: false })
          .limit(2000);
        (data || []).forEach((r: any) => {
          const k = norm(r.hsn_code);
          if (k && !rmbByHsn.has(k)) rmbByHsn.set(k, r as RmbReference);
        });
      }

      return lines.map((i) => {
        const product = i.product_id ? productMap.get(i.product_id) : null;
        const model = norm(i.model_number) || norm(product?.model_number);
        const hsn = norm(i.hsn_code) || norm(product?.hsn_code);
        const rmb = (model && rmbByModel.get(model)) || (hsn && rmbByHsn.get(hsn)) || null;

        return {
          model_number: i.model_number || product?.model_number || null,
          description: i.product_description || i.description || product?.name || '',
          quantity: Number(i.quantity) || 0,
          unit: i.unit || 'Nos',
          rate: Number(i.rate) || 0,
          amount: Number(i.amount) || 0,
          discount_percent: Number(i.discount_percent) || 0,
          discount_amount: Number(i.discount_amount) || 0,
          tax_percent: Number(i.tax_percent) || 0,
          list_price: product?.list_price ?? null,
          list_price_source: product?.list_price_source ?? null,
          min_margin_pct: product?.min_margin_pct ?? null,
          rmb,
        } satisfies ComparisonInputRow;
      });
    },
  });
}

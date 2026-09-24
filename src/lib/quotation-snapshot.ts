import { supabase } from '@/integrations/supabase/client';
import { computePricing } from '@/lib/pricing';

export interface PriceSnapshot {
  snap_list_price: number | null;
  snap_sales_discount_pct: number | null;
  snap_sales_price: number | null;
  snap_purchase_discount_pct: number | null;
  snap_purchase_price: number | null;
  snap_gross_profit: number | null;
  snap_gross_margin_pct: number | null;
  snap_product_status: string | null;
  /** The exact price version the frozen figures came from */
  price_version_id: string | null;
}

const EMPTY: PriceSnapshot = {
  snap_list_price: null,
  snap_sales_discount_pct: null,
  snap_sales_price: null,
  snap_purchase_discount_pct: null,
  snap_purchase_price: null,
  snap_gross_profit: null,
  snap_gross_margin_pct: null,
  snap_product_status: null,
  price_version_id: null,
};

/**
 * Freezes today's catalog pricing for every product used on a quotation.
 * Historic quotations must never change when a new price list is uploaded.
 */
export async function buildPriceSnapshots(
  productIds: Array<string | null | undefined>,
): Promise<Map<string, PriceSnapshot>> {
  const ids = Array.from(new Set(productIds.filter(Boolean) as string[]));
  const map = new Map<string, PriceSnapshot>();
  if (!ids.length) return map;

  const { data, error } = await supabase
    .from('products')
    .select('id, list_price, sales_discount_pct, purchase_discount_pct, sales_price, purchase_price, default_rate, product_status')
    .in('id', ids);

  if (error || !data) return map;

  // Latest recorded price version per product, so the line can be traced back to it.
  const versionByProduct = new Map<string, string>();
  const { data: versions } = await supabase
    .from('product_price_versions')
    .select('id, product_id, effective_date, created_at')
    .in('product_id', ids)
    .order('created_at', { ascending: false });
  for (const v of (versions ?? []) as any[]) {
    if (!versionByProduct.has(v.product_id)) versionByProduct.set(v.product_id, v.id);
  }

  for (const p of data as any[]) {
    const pricing = computePricing(p);
    map.set(p.id, {
      snap_list_price: pricing.listPrice,
      snap_sales_discount_pct: pricing.salesDiscountPct,
      snap_sales_price: pricing.salesPrice,
      snap_purchase_discount_pct: pricing.purchaseDiscountPct,
      snap_purchase_price: pricing.purchasePrice,
      snap_gross_profit: pricing.grossProfit,
      snap_gross_margin_pct: pricing.grossMarginPct,
      snap_product_status: pricing.status,
      price_version_id: versionByProduct.get(p.id) ?? null,
    });
  }
  return map;
}

export function snapshotFor(map: Map<string, PriceSnapshot>, productId?: string | null): PriceSnapshot {
  if (!productId) return EMPTY;
  return map.get(productId) ?? EMPTY;
}

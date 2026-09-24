import { supabase } from '@/integrations/supabase/client';
import { getUserTenantId } from '@/utils/tenantUtils';
import { deriveModelNumber } from '@/lib/description-utils';
import { normalizeModel } from '@/lib/model-normalize';

export interface CatalogPriceSyncInput {
  /** Enquiry item this price belongs to (used to find the linked product). */
  enquiryItemId?: string | null;
  /** Raw item text as typed by sales. */
  productText?: string | null;
  brand?: string | null;
  price: number;
  supplierId?: string | null;
  leadTimeDays?: number | null;
  validUntil?: string | null;
  /** price_request id, for the history trail. */
  referenceId?: string | null;
}

async function findProductId(
  itemProductId: string | null,
  productText: string | null | undefined
): Promise<string | null> {
  if (itemProductId) return itemProductId;
  const text = (productText || '').trim();
  if (!text) return null;

  const model = (deriveModelNumber(null, text, text) || text).trim();

  // 1) model number — look-alike tolerant (O/0, I/1, L/1, separators, case)
  if (model) {
    const key = normalizeModel(model);
    if (key.length >= 3) {
      const { data } = await supabase
        .from('products')
        .select('id')
        .eq('search_key', key)
        .limit(1);
      if (data?.[0]) return data[0].id;
    }
    const { data } = await supabase
      .from('products')
      .select('id')
      .ilike('model_number', model)
      .limit(1);
    if (data?.[0]) return data[0].id;
  }

  // 2) hsn code
  if (model) {
    const { data } = await supabase
      .from('products')
      .select('id')
      .ilike('hsn_code', model)
      .limit(1);
    if (data?.[0]) return data[0].id;
  }

  // 3) exact name
  const { data } = await supabase.from('products').select('id').ilike('name', text).limit(1);
  return data?.[0]?.id ?? null;
}

/**
 * Persists a procurement-resolved price onto the product catalog so it can be
 * reused by every future enquiry / quotation, together with its validity date.
 * Creates a catalog product when nothing matches, and always writes a
 * product_price_history row.
 *
 * Never throws — catalog sync must not break the price save itself.
 */
export async function syncPriceToCatalog(input: CatalogPriceSyncInput): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    let itemProductId: string | null = null;
    let text = input.productText || null;
    let brand = input.brand || null;

    if (input.enquiryItemId) {
      const { data: item } = await supabase
        .from('enquiry_items')
        .select('matched_product_id, product_query_text, brand')
        .eq('id', input.enquiryItemId)
        .maybeSingle();
      if (item) {
        itemProductId = (item as any).matched_product_id ?? null;
        text = text || (item as any).product_query_text || null;
        brand = brand || (item as any).brand || null;
      }
    }

    let productId = await findProductId(itemProductId, text);
    const tenantId = await getUserTenantId();
    const nowIso = new Date().toISOString();

    let oldRate: number | null = null;

    if (productId) {
      const { data: existing } = await supabase
        .from('products')
        .select('purchase_price')
        .eq('id', productId)
        .maybeSingle();
      oldRate = (existing as any)?.purchase_price ?? null;

      await supabase
        .from('products')
        .update({
          purchase_price: input.price,
          price_valid_until: input.validUntil || null,
          price_source: 'procurement',
          last_quote_supplier_id: input.supplierId || null,
          preferred_supplier_id: input.supplierId || undefined,
          lead_time_days: input.leadTimeDays ?? undefined,
          price_updated_at: nowIso,
          price_updated_by: user?.id ?? null,
        } as any)
        .eq('id', productId);
    } else if (text) {
      const model = deriveModelNumber(null, text, text);
      const desc = text;
      const { data: created, error } = await supabase
        .from('products')
        .insert({
          name: model || text.slice(0, 120),
          model_number: model || null,
          description: desc,
          brand,
          purchase_price: input.price,
          price_valid_until: input.validUntil || null,
          price_source: 'procurement',
          last_quote_supplier_id: input.supplierId || null,
          preferred_supplier_id: input.supplierId || null,
          lead_time_days: input.leadTimeDays ?? null,
          price_updated_at: nowIso,
          price_updated_by: user?.id ?? null,
          is_active: true,
          tenant_id: tenantId,
        } as any)
        .select('id')
        .single();
      if (error) throw error;
      productId = created?.id ?? null;
    }

    if (!productId) return null;

    // Keep the enquiry item pointed at the catalog product
    if (input.enquiryItemId && !itemProductId) {
      await supabase
        .from('enquiry_items')
        .update({ matched_product_id: productId } as any)
        .eq('id', input.enquiryItemId);
    }

    await supabase.from('product_price_history').insert({
      product_id: productId,
      old_rate: oldRate,
      new_rate: input.price,
      supplier_id: input.supplierId || null,
      changed_by: user?.id ?? null,
      change_reason: input.validUntil
        ? `Procurement price · valid till ${input.validUntil}`
        : 'Procurement price',
      source: 'procurement',
      reference_id: input.referenceId || null,
    } as any);

    return productId;
  } catch (e) {
    console.error('syncPriceToCatalog failed', e);
    return null;
  }
}

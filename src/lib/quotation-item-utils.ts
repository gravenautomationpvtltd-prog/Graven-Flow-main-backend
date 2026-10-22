import { supabase } from '@/integrations/supabase/client';
import { isLikelyTruncatedDescription, pickBestDescription, deriveModelNumber } from './description-utils';

type ProductPrintFields = {
  id: string;
  model_number: string | null;
  description: string | null;
  name: string | null;
  weight_kg?: number | null;
  unit_weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  dimensions?: string | null;
};

function printableProductDescription(product?: Pick<ProductPrintFields, 'description' | 'name' | 'model_number'> | null) {
  const model = product?.model_number?.trim() || '';
  const description = product?.description?.trim() || '';
  const name = product?.name?.trim() || '';

  if (description && description.toUpperCase() !== model.toUpperCase()) return description;
  if (name && name.toUpperCase() !== model.toUpperCase()) return name;
  return description || name || null;
}

// In-memory cache for product catalog print fields across PDF generation calls
const productPrintFieldsCache = new Map<string, ProductPrintFields>();
const quotationPrintItemsCache = new Map<string, { timestamp: number; items: any[] }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache window

/**
 * Ensure every quotation item has catalog print fields populated by joining products.
 * - `model_number` prints as the bold first line in customer PDFs.
 * - `product_description` prints as the italic second line in customer PDFs.
 */
export async function ensureItemsWithModelNumber(
  quotationId: string,
  items?: any[] | null,
): Promise<any[]> {
  // Check fast cache first
  const cached = quotationPrintItemsCache.get(quotationId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    if (!items || items.length === 0 || items.length === cached.items.length) {
      return cached.items;
    }
  }

  // No items passed → fetch with join
  if (!items || items.length === 0) {
    const { data, error } = await supabase
      .from('quotation_items')
      .select('*, product:products(model_number, description, name, weight_kg, length_cm, width_cm, height_cm)')
      .eq('quotation_id', quotationId)
      .order('sort_order');
    if (error) throw error;
    const resolved = (data || []).map((it: any) => {
      if (it.product && it.product_id) {
        productPrintFieldsCache.set(it.product_id, {
          id: it.product_id,
          ...it.product,
        });
      }
      return {
        ...it,
        model_number: deriveModelNumber(
          it.product?.model_number ?? it.model_number ?? null,
          it.product?.name ?? null,
          it.description ?? null,
        ),
        product_description: pickBestDescription(
          it.product_description ?? it.description,
          printableProductDescription(it.product),
          it.product?.model_number ?? it.model_number ?? null,
        ) || null,
        weight_kg: it.weight_kg ?? it.unit_weight_kg ?? it.product?.weight_kg ?? it.product?.unit_weight_kg ?? null,
        unit_weight_kg: it.unit_weight_kg ?? it.weight_kg ?? it.product?.unit_weight_kg ?? it.product?.weight_kg ?? null,
        length_cm: it.length_cm ?? it.product?.length_cm ?? null,
        width_cm: it.width_cm ?? it.product?.width_cm ?? null,
        height_cm: it.height_cm ?? it.product?.height_cm ?? null,
        dimensions: it.dimensions ?? null,
        product: it.product || undefined,
      };
    });
    quotationPrintItemsCache.set(quotationId, { timestamp: Date.now(), items: resolved });
    return resolved;
  }

  // Items exist — check which need catalog print-field resolution
  const missingProductIds: string[] = [];
  items.forEach((it: any) => {
    if (!it?.product_id) return;
    if (productPrintFieldsCache.has(it.product_id)) return;
    if (it.product && (it.product.model_number || it.model_number) && (it.product.description || it.product_description)) {
      productPrintFieldsCache.set(it.product_id, {
        id: it.product_id,
        ...it.product,
      });
      return;
    }
    const model = it?.model_number ?? null;
    const needsFetch = (
      !model ||
      !it?.product_description ||
      (it?.weight_kg == null && it?.length_cm == null && !it?.product) ||
      isLikelyTruncatedDescription(it.product_description, model) ||
      isLikelyTruncatedDescription(it.description, model)
    );
    if (needsFetch) {
      missingProductIds.push(it.product_id);
    }
  });

  const uniqueMissingIds = Array.from(new Set(missingProductIds));
  if (uniqueMissingIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, model_number, description, name, weight_kg, length_cm, width_cm, height_cm')
      .in('id', uniqueMissingIds);

    (products || []).forEach((p: ProductPrintFields) => productPrintFieldsCache.set(p.id, p));
  }

  const resolved = items.map((it: any) => {
    const product = it.product_id ? productPrintFieldsCache.get(it.product_id) : undefined;
    const modelNumber = deriveModelNumber(
      it.model_number ?? product?.model_number ?? null,
      product?.name ?? null,
      it.description ?? null,
    );
    const catalogDescription = printableProductDescription(product);
    const bestDescription = pickBestDescription(
      it.product_description ?? it.description,
      catalogDescription,
      modelNumber,
    );
    return {
      ...it,
      model_number: modelNumber,
      product_description: bestDescription || null,
      weight_kg: it.weight_kg ?? it.unit_weight_kg ?? product?.weight_kg ?? null,
      unit_weight_kg: it.unit_weight_kg ?? it.weight_kg ?? product?.weight_kg ?? null,
      length_cm: it.length_cm ?? product?.length_cm ?? null,
      width_cm: it.width_cm ?? product?.width_cm ?? null,
      height_cm: it.height_cm ?? product?.height_cm ?? null,
      dimensions: it.dimensions ?? null,
      product: it.product || product || undefined,
    };
  });

  quotationPrintItemsCache.set(quotationId, { timestamp: Date.now(), items: resolved });
  return resolved;
}

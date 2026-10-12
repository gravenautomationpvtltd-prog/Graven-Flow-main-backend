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

/**
 * Ensure every quotation item has catalog print fields populated by joining products.
 * - `model_number` prints as the bold first line in customer PDFs.
 * - `product_description` prints as the italic second line in customer PDFs.
 */
export async function ensureItemsWithModelNumber(
  quotationId: string,
  items?: any[] | null,
): Promise<any[]> {
  // No items passed → fetch with join
  if (!items || items.length === 0) {
    const { data, error } = await supabase
      .from('quotation_items')
      .select('*, product:products(model_number, description, name, weight_kg, length_cm, width_cm, height_cm)')
      .eq('quotation_id', quotationId)
      .order('sort_order');
    if (error) throw error;
    return (data || []).map((it: any) => ({
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
    }));
  }

  // Items exist — check if any need catalog print-field resolution
  const missing = items.filter((it: any) => {
    if (!it?.product_id) return false;
    // If product details are already joined/present, no need to refetch
    if (it.product && (it.product.model_number || it.model_number) && (it.product.description || it.product_description)) return false;
    const model = it?.model_number ?? null;
    return (
      !model ||
      !it?.product_description ||
      (it?.weight_kg == null && it?.length_cm == null && !it?.product) ||
      isLikelyTruncatedDescription(it.product_description, model) ||
      isLikelyTruncatedDescription(it.description, model)
    );
  });
  if (missing.length === 0) return items;

  const productIds = Array.from(new Set(missing.map((it: any) => it.product_id)));
  const { data: products } = await supabase
    .from('products')
    .select('id, model_number, description, name, weight_kg, length_cm, width_cm, height_cm')
    .in('id', productIds);

  const map = new Map<string, ProductPrintFields>();
  (products || []).forEach((p: ProductPrintFields) => map.set(p.id, p));

  return items.map((it: any) => {
    const product = it.product_id ? map.get(it.product_id) : undefined;
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
}

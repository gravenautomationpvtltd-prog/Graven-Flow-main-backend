import { supabase } from '@/integrations/supabase/client';
import { isLikelyTruncatedDescription, pickBestDescription, deriveModelNumber } from './description-utils';

type ProductPrintFields = {
  id: string;
  model_number: string | null;
  description: string | null;
  name: string | null;
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
      .select('*, product:products(model_number, description, name)')
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
    }));
  }

  // Items exist — check if any need catalog print-field resolution
  const missing = items.filter((it: any) => {
    if (!it?.product_id) return false;
    const model = it?.model_number ?? null;
    return (
      !model ||
      !it?.product_description ||
      isLikelyTruncatedDescription(it.product_description, model) ||
      isLikelyTruncatedDescription(it.description, model)
    );
  });
  if (missing.length === 0) return items;

  const productIds = Array.from(new Set(missing.map((it: any) => it.product_id)));
  const { data: products } = await supabase
    .from('products')
    .select('id, model_number, description, name')
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
    };
  });
}

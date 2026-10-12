import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity-logger';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';
import { pickBestDescription, deriveModelNumber } from '@/lib/description-utils';
import { buildPriceSnapshots, snapshotFor, type PriceSnapshot } from '@/lib/quotation-snapshot';
import { normalizeModel } from '@/lib/model-normalize';
import { computePricing } from '@/lib/pricing';
import { invalidateDashboardData } from '@/lib/dashboard-invalidation';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  hsn_code: string | null;
  unit: string | null;
  default_rate: number | null;
  purchase_price: number | null;
  category: string | null;
  tax_rate: number | null;
  is_active: boolean | null;
  price_updated_at: string | null;
  price_updated_by: string | null;
  lead_time_days: number | null;
  preferred_supplier_id: string | null;
  model_number?: string | null;
  brand?: string | null;
  list_price?: number | null;
  list_price_source?: string | null;
  price_valid_until?: string | null;
  min_margin_pct?: number | null;
  product_status?: 'active' | 'discontinued' | 'obsolete' | null;
  sales_price?: number | null;
  sales_discount_pct?: number | null;
  purchase_discount_pct?: number | null;
  replacement_model_no?: string | null;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
}

/**
 * Internal-only pricing floor for branded list-price products.
 * If a product has a list_price and min_margin_pct (e.g. Siemens 60%),
 * the customer-facing rate must never be lower than list_price * (1 - min_margin_pct/100).
 * Returns { floor, applied, enteredRate } where the caller should quote max(entered, floor).
 * The list price itself is NEVER shown to the customer.
 */
export function computePriceFloor(
  product: Pick<Product, 'list_price' | 'min_margin_pct'> | null | undefined,
  enteredRate: number,
): { floor: number | null; effectiveRate: number; floorApplied: boolean } {
  const lp = product?.list_price ?? null;
  const mm = product?.min_margin_pct ?? null;
  if (!lp || !mm || lp <= 0 || mm <= 0) {
    return { floor: null, effectiveRate: enteredRate, floorApplied: false };
  }
  const floor = Math.round(lp * (1 - mm / 100) * 100) / 100;
  const effective = Math.max(enteredRate || 0, floor);
  return { floor, effectiveRate: effective, floorApplied: (enteredRate || 0) < floor };
}

function printableProductDescription(product?: Pick<Product, 'description' | 'name' | 'model_number'> | null): string | null {
  const model = product?.model_number?.trim() || '';
  const description = product?.description?.trim() || '';

  // Only the catalog description is printable — never the product name.
  if (description && description.toUpperCase() !== model.toUpperCase()) return description;
  return null;
}

export interface QuotationItem {
  id?: string;
  quotation_id?: string;
  product_id?: string | null;
  enquiry_item_id?: string | null;
  description: string;
  model_number?: string | null;
  product_description?: string | null;
  hsn_code?: string | null;
  quantity: number;
  unit: string;
  rate: number;
  target_rate?: number | null;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  amount: number;
  sort_order: number;
  lead_time_days?: number | null;
  unit_weight_kg?: number | null;
  total_weight_kg?: number | null;
  dimensions?: string | null;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
}

export interface Quotation {
  id: string;
  quotation_number: string;
  lead_id: string | null;
  customer_id: string | null;
  created_by: string | null;
  status: string;
  subject: string | null;
  notes: string | null;
  terms_conditions: string | null;
  subtotal: number;
  total_discount: number;
  total_tax: number;
  grand_total: number;
  valid_until: string | null;
  sent_at: string | null;
  sent_via: string | null;
  loss_reason: string | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationWithDetails extends Quotation {
  customer?: {
    id: string;
    company_name: string;
    contact_person: string | null;
    phone: string;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    gst_number: string | null;
  } | null;
  lead?: {
    id: string;
    title: string;
  } | null;
  items?: QuotationItem[];
  created_by_profile?: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, hsn_code, unit, default_rate, purchase_price, category, tax_rate, is_active, lead_time_days, model_number, brand, list_price, list_price_source, min_margin_pct, price_valid_until, product_status, sales_price, sales_discount_pct, purchase_discount_pct, replacement_model_no')
        .eq('is_active', true)
        .order('name')
        .limit(2000);
      if (error) throw error;
      return data as Product[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache to prevent continuous 25k downloads
    gcTime: 15 * 60 * 1000,
  });
}

// Server-side product search hook for large catalogs
export function useProductSearch(searchQuery: string) {
  return useQuery({
    queryKey: ['products-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      
      const term = searchQuery.trim();
      // Model numbers are matched ignoring case, spaces and dashes.
      const normTerm = normalizeModel(term);
      const filters = [
        `name.ilike.%${term}%`,
        `hsn_code.ilike.%${term}%`,
        `description.ilike.%${term}%`,
        `model_number.ilike.%${term}%`,
        `brand.ilike.%${term}%`,
      ];
      // search_key folds separators, case and look-alike O/0, I/1, L/1
      // (falls back to the product name when no model number is stored)
      if (normTerm.length >= 2) filters.push(`search_key.ilike.%${normTerm}%`);

      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, hsn_code, unit, default_rate, purchase_price, category, tax_rate, is_active, price_updated_at, price_updated_by, lead_time_days, model_number, brand, list_price, list_price_source, min_margin_pct, price_valid_until, product_status, sales_price, sales_discount_pct, purchase_discount_pct, replacement_model_no, weight_kg, length_cm, width_cm, height_cm')
        .eq('is_active', true)
        .or(filters.join(','))
        .order('name')
        .limit(50);

      if (error) throw error;
      // Exact / prefix model matches first so a pasted model number lands on top
      const rank = (p: any) => {
        const m = normalizeModel(p.model_number || p.name);
        if (!normTerm) return 3;
        if (m === normTerm) return 0;
        if (m.startsWith(normTerm)) return 1;
        if (m.includes(normTerm)) return 2;
        return 3;
      };
      return ([...(data || [])].sort((a, b) => rank(a) - rank(b))) as unknown as Product[];
    },
    enabled: searchQuery.trim().length > 0,
  });
}

export function useQuotations(leadId?: string) {
  return useQuery({
    queryKey: ['quotations', leadId],
    staleTime: 30 * 1000,
    queryFn: async () => {
      let query = supabase
        .from('quotations')
        .select(`
          *,
          customer:customers(id, company_name, contact_person, phone, email, address, city, state, pincode, gst_number),
          lead:leads(id, title),
          created_by_profile:profiles!quotations_created_by_fkey(id, full_name, email, phone)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (leadId) {
        query = query.eq('lead_id', leadId);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as QuotationWithDetails[];
    },
  });
}

export function useQuotation(id: string | undefined, includeDeleted = false) {
  return useQuery({
    queryKey: ['quotation', id, includeDeleted],
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!id) return null;

      let query = supabase
        .from('quotations')
        .select(`
          *,
          customer:customers(id, company_name, contact_person, phone, email, address, city, state, pincode, gst_number),
          lead:leads(id, title),
          created_by_profile:profiles!quotations_created_by_fkey(id, full_name, email, phone)
        `)
        .eq('id', id);

      // Only filter by deleted_at if not including deleted items
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data: quotation, error: quotationError } = await query.single();

      if (quotationError) throw quotationError;

      const { data: rawItems, error: itemsError } = await supabase
        .from('quotation_items')
        .select('*, product:products(model_number, description, name, weight_kg, length_cm, width_cm, height_cm)')
        .eq('quotation_id', id)
        .order('sort_order');

      if (itemsError) throw itemsError;

      // Flatten catalog print fields onto each item so PDF renderers can use them immediately
      const items = (rawItems || []).map((it: any) => ({
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
        weight_kg: it.weight_kg ?? it.unit_weight_kg ?? it.product?.weight_kg ?? null,
        unit_weight_kg: it.unit_weight_kg ?? it.weight_kg ?? it.product?.weight_kg ?? null,
        total_weight_kg: it.total_weight_kg ?? ((it.unit_weight_kg ?? it.weight_kg ?? it.product?.weight_kg) && it.quantity ? Math.round(Number(it.unit_weight_kg ?? it.weight_kg ?? it.product?.weight_kg) * Number(it.quantity) * 1000) / 1000 : null),
        dimensions: it.dimensions ?? (it.length_cm && it.width_cm && it.height_cm ? `${it.length_cm} × ${it.width_cm} × ${it.height_cm} CM` : (it.product?.length_cm && it.product?.width_cm && it.product?.height_cm ? `${it.product.length_cm} × ${it.product.width_cm} × ${it.product.height_cm} CM` : null)),
        length_cm: it.length_cm ?? it.product?.length_cm ?? null,
        width_cm: it.width_cm ?? it.product?.width_cm ?? null,
        height_cm: it.height_cm ?? it.product?.height_cm ?? null,
      }));

      return { ...quotation, items } as QuotationWithDetails;
    },
    enabled: !!id,
  });
}

// Helper function to sync quotation data back to enquiry items and price requests
async function syncQuotationToEnquiryItems(
  leadId: string,
  items: QuotationItem[],
  queryClient: ReturnType<typeof useQueryClient>
) {
  if (!leadId) return;

  // Get all enquiry items for this lead
  const { data: enquiryItems, error: fetchError } = await supabase
    .from('enquiry_items')
    .select('id, product_query_text, matched_product_id')
    .eq('lead_id', leadId);

  if (fetchError || !enquiryItems?.length) return;

  const updatePromises: Promise<any>[] = [];
  let updatedCount = 0;

  for (const qItem of items) {
    // First try to match by enquiry_item_id if set
    let matchId = qItem.enquiry_item_id;
    
    // If no direct link, match by product_id or by similar description
    if (!matchId) {
      const match = enquiryItems.find(ei => {
        if (ei.matched_product_id && qItem.product_id && ei.matched_product_id === qItem.product_id) {
          return true;
        }
        const qDesc = qItem.description.toLowerCase().trim();
        const eiText = ei.product_query_text.toLowerCase().trim();
        return qDesc.includes(eiText) || eiText.includes(qDesc) || qDesc === eiText;
      });
      matchId = match?.id;
    }

    if (matchId) {
      const updateData: Record<string, unknown> = {
        price_available: true,
      };

      if (qItem.target_rate && qItem.target_rate > 0) {
        updateData.target_rate = qItem.target_rate;
      }

      const enquiryItem = enquiryItems.find(ei => ei.id === matchId);
      if (qItem.product_id && enquiryItem && !enquiryItem.matched_product_id) {
        updateData.matched_product_id = qItem.product_id;
      }

      updatedCount++;
      updatePromises.push(
        supabase
          .from('enquiry_items')
          .update(updateData)
          .eq('id', matchId)
      );

      if (qItem.target_rate && qItem.target_rate > 0) {
        updatePromises.push(
          supabase
            .from('price_requests')
            .update({ target_rate: qItem.target_rate })
            .eq('enquiry_item_id', matchId)
        );
      }
    }
  }

  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }

  if (updatedCount > 0) {
    queryClient.invalidateQueries({ queryKey: ['enquiry-items', leadId] });
    queryClient.invalidateQueries({ queryKey: ['price-requests'] });
  }
}

// Helper function to auto-save custom items to product catalog in batch
// NOTE: Does NOT update existing product prices - catalog prices are only changed via Products management
async function autoSaveCustomProducts(
  items: QuotationItem[],
  queryClient: ReturnType<typeof useQueryClient>,
  currency: string = 'INR',
  exchangeRate: number = 1
) {
  const customItems = items.filter(item => !item.product_id);
  if (!customItems.length) return;

  // Extract unique product names
  const itemsByName = new Map<string, QuotationItem>();
  for (const item of customItems) {
    const name = item.description.includes(' - ') 
      ? item.description.split(' - ')[0].trim()
      : item.description.trim();
    if (name && !itemsByName.has(name.toLowerCase())) {
      itemsByName.set(name.toLowerCase(), { ...item, description: name });
    }
  }

  if (itemsByName.size === 0) return;

  const names = Array.from(itemsByName.values()).map(it => it.description);
  const { data: existingProducts } = await supabase
    .from('products')
    .select('name')
    .in('name', names);

  const existingNamesLower = new Set(
    (existingProducts || []).map((p: any) => p.name.trim().toLowerCase())
  );

  const toInsert: any[] = [];
  const addedProducts: string[] = [];
  const tenantId = await requireTenantId();

  for (const [lowerName, item] of itemsByName.entries()) {
    if (!existingNamesLower.has(lowerName)) {
      const rateInINR = currency !== 'INR' && exchangeRate > 0 && exchangeRate !== 1
        ? item.rate * exchangeRate
        : item.rate;

      toInsert.push({
        name: item.description,
        description: item.description,
        hsn_code: item.hsn_code || null,
        unit: item.unit || 'Nos',
        default_rate: rateInINR || 0,
        tax_rate: item.tax_percent || 18,
        is_active: true,
        tenant_id: tenantId,
      });
      addedProducts.push(item.description);
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('products').insert(toInsert);
    if (!insertError) {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`${addedProducts.length} product(s) added to catalog: ${addedProducts.join(', ')}`);
    }
  }
}

// Helper function to validate UUIDs
function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

interface PreparedQuotationItemsResult {
  items: QuotationItem[];
  snapshots: Map<string, PriceSnapshot>;
  floorAdjusted: number;
}

/**
 * Unified parallel item preparation:
 * Validates product IDs, hydrations catalog descriptions, enforces list-price floors,
 * and builds price snapshots in a SINGLE round-trip instead of 4-5 sequential round-trips.
 */
async function prepareQuotationItems(rawItems: QuotationItem[]): Promise<PreparedQuotationItemsResult> {
  const productIds = Array.from(
    new Set(
      rawItems
        .map((item) => item.product_id)
        .filter((id): id is string => !!id && isValidUUID(id))
    )
  );

  if (productIds.length === 0) {
    const cleaned = rawItems.map((item) => ({
      ...item,
      product_id: null,
    }));
    return {
      items: cleaned,
      snapshots: new Map(),
      floorAdjusted: 0,
    };
  }

  // Fetch catalog details and price versions concurrently in 1 parallel query
  const [productsRes, versionsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, description, model_number, list_price, min_margin_pct, sales_discount_pct, purchase_discount_pct, sales_price, purchase_price, default_rate, product_status')
      .in('id', productIds),
    supabase
      .from('product_price_versions')
      .select('id, product_id, effective_date, created_at')
      .in('product_id', productIds)
      .order('created_at', { ascending: false }),
  ]);

  const productsList = productsRes.data || [];
  const validProductsMap = new Map<string, any>(productsList.map((p: any) => [p.id, p]));

  // Build price versions lookup
  const versionByProduct = new Map<string, string>();
  for (const v of (versionsRes.data ?? []) as any[]) {
    if (!versionByProduct.has(v.product_id)) {
      versionByProduct.set(v.product_id, v.id);
    }
  }

  // Build snapshots map
  const snapshots = new Map<string, PriceSnapshot>();
  for (const p of productsList) {
    const pricing = computePricing(p);
    snapshots.set(p.id, {
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

  let floorAdjusted = 0;

  // Process items in memory: validate ID, hydrate catalog descriptions, apply price floor
  const processedItems = rawItems.map((item) => {
    const pid = item.product_id && validProductsMap.has(item.product_id) ? item.product_id : null;
    let nextItem: QuotationItem = { ...item, product_id: pid };

    if (!pid) return nextItem;

    const product = validProductsMap.get(pid);
    if (product) {
      // 1. Hydrate catalog description & model number
      const modelNumber = item.model_number || product.model_number || null;
      const catalogDescription = printableProductDescription(product as Product);
      const bestDescription = pickBestDescription(
        item.product_description || item.description,
        catalogDescription,
        modelNumber,
      );

      nextItem = {
        ...nextItem,
        model_number: modelNumber,
        product_description: bestDescription || item.product_description || null,
        description: bestDescription || item.description,
      };

      // 2. Enforce price floor
      const { floor, effectiveRate, floorApplied } = computePriceFloor(
        { list_price: product.list_price ?? null, min_margin_pct: product.min_margin_pct ?? null },
        Number(item.rate) || 0,
      );

      if (floor && floorApplied) {
        floorAdjusted += 1;
        const rate = effectiveRate;
        const qty = Number(item.quantity) || 0;
        const gross = rate * qty;
        const discountAmount = Math.round(gross * ((Number(item.discount_percent) || 0) / 100) * 100) / 100;
        const taxable = gross - discountAmount;
        const taxAmount = Math.round(taxable * ((Number(item.tax_percent) || 0) / 100) * 100) / 100;
        const amount = Math.round((taxable + taxAmount) * 100) / 100;

        nextItem = {
          ...nextItem,
          rate,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          amount,
        };
      }
    }

    return nextItem;
  });

  return {
    items: processedItems,
    snapshots,
    floorAdjusted,
  };
}



// Mutex and short-term cache to prevent duplicate quotations from concurrent requests
const inFlightQuotationCreations = new Map<string, Promise<any>>();
const recentQuotationCreations = new Map<string, { quotation: any; timestamp: number }>();

function getQuotationDedupKey(quotation: Partial<Quotation>, items: QuotationItem[]): string {
  const targetId = quotation.lead_id || quotation.customer_id || 'standalone';
  const itemSig = (items || [])
    .map(i => `${i.product_id || ''}:${(i.description || '').trim().toLowerCase()}:${i.quantity}:${i.rate}`)
    .sort()
    .join('|');
  const total = Number(quotation.grand_total) || 0;
  return `${targetId}::${total.toFixed(2)}::${itemSig}`;
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      quotation,
      items,
    }: {
      quotation: Partial<Quotation>;
      items: QuotationItem[];
    }) => {
      const dedupKey = getQuotationDedupKey(quotation, items);

      // 1. Check if an identical quotation is actively being created right now
      const inFlight = inFlightQuotationCreations.get(dedupKey);
      if (inFlight) {
        console.warn('[useCreateQuotation] Concurrent request detected. Reusing in-flight quotation creation.');
        return await inFlight;
      }

      // 2. Check if an identical quotation was created in the last 4 seconds
      const recent = recentQuotationCreations.get(dedupKey);
      if (recent && (Date.now() - recent.timestamp < 4000)) {
        console.warn('[useCreateQuotation] Duplicate request within 4 seconds. Reusing quotation:', recent.quotation.quotation_number);
        return recent.quotation;
      }

      const createPromise = (async () => {
        // Prepare items concurrently: validate IDs, hydrate descriptions, apply price floor, and build snapshots in 1 parallel round-trip
        const [prepared, tenantId] = await Promise.all([
          prepareQuotationItems(items),
          (async () => {
            await ensureFreshSession();
            return requireTenantId();
          })(),
        ]);

        const { items: validatedItems, snapshots, floorAdjusted } = prepared;
        if (floorAdjusted > 0) {
          toast.info(`${floorAdjusted} line item${floorAdjusted > 1 ? 's' : ''} raised to internal list-price floor.`);
        }

        let newQuotation: any = null;
        if (quotation.lead_id) {
          const { data: existingDraft } = await supabase
            .from('quotations')
            .select('*')
            .eq('lead_id', quotation.lead_id)
            .eq('status', 'draft')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingDraft) {
            console.log('[useCreateQuotation] Converting existing draft quotation into pending quotation:', existingDraft.quotation_number);
            const { data: updatedQ, error: updError } = await supabase
              .from('quotations')
              .update({
                customer_id: quotation.customer_id || existingDraft.customer_id,
                created_by: quotation.created_by || existingDraft.created_by,
                subject: quotation.subject || existingDraft.subject,
                notes: quotation.notes || existingDraft.notes,
                terms_conditions: quotation.terms_conditions || existingDraft.terms_conditions,
                subtotal: quotation.subtotal,
                total_discount: quotation.total_discount,
                total_tax: quotation.total_tax,
                grand_total: quotation.grand_total,
                advance_percent: (quotation as any).advance_percent ?? null,
                advance_amount: (quotation as any).advance_amount ?? null,
                balance_amount: (quotation as any).balance_amount ?? null,
                payment_remark: (quotation as any).payment_remark ?? null,
                advance_remark: (quotation as any).advance_remark ?? null,
                balance_remark: (quotation as any).balance_remark ?? null,
                valid_until: quotation.valid_until,
                status: quotation.status || 'pending',
                currency: quotation.currency || 'INR',
                exchange_rate: (quotation as any).exchange_rate || 1,
                updated_at: new Date().toISOString(),
              } as any)
              .eq('id', existingDraft.id)
              .select()
              .single();

            if (updError) throw updError;
            newQuotation = updatedQ;
            // Clear prior items for this draft before inserting finalized items
            await supabase.from('quotation_items').delete().eq('quotation_id', existingDraft.id);
          }
        }

        if (!newQuotation) {
          const { data: insertedQuotation, error: quotationError } = await supabase
            .from('quotations')
            .insert({
              quotation_number: `QT-TEMP-${Date.now()}`, // Will be replaced by trigger
              lead_id: quotation.lead_id,
              customer_id: quotation.customer_id,
              created_by: quotation.created_by,
              subject: quotation.subject,
              notes: quotation.notes,
              terms_conditions: quotation.terms_conditions,
              subtotal: quotation.subtotal,
              total_discount: quotation.total_discount,
              total_tax: quotation.total_tax,
              grand_total: quotation.grand_total,
              advance_percent: (quotation as any).advance_percent ?? null,
              advance_amount: (quotation as any).advance_amount ?? null,
              balance_amount: (quotation as any).balance_amount ?? null,
              payment_remark: (quotation as any).payment_remark ?? null,
              advance_remark: (quotation as any).advance_remark ?? null,
              balance_remark: (quotation as any).balance_remark ?? null,
              valid_until: quotation.valid_until,
              status: quotation.status || 'pending',
              currency: quotation.currency || 'INR',
              exchange_rate: (quotation as any).exchange_rate || 1,
              tenant_id: tenantId,
            } as any)
            .select()
            .single();

          if (quotationError) throw quotationError;
          newQuotation = insertedQuotation;
        }

        // Create items with validated product IDs and price snapshots
        if (validatedItems.length > 0) {
          const itemsToInsert = validatedItems.map((item, index) => ({
            ...snapshotFor(snapshots, item.product_id),
            quotation_id: newQuotation.id,
            product_id: item.product_id || null,
            enquiry_item_id: item.enquiry_item_id || null,
            description: item.description,
            hsn_code: item.hsn_code,
            model_number: (item as any).model_number || null,
            product_description: (item as any).product_description || null,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate,
            target_rate: item.target_rate || null,
            discount_percent: item.discount_percent,
            discount_amount: item.discount_amount,
            tax_percent: item.tax_percent,
            tax_amount: item.tax_amount,
            amount: item.amount,
            sort_order: index,
            lead_time_days: item.lead_time_days || null,
            unit_weight_kg: item.unit_weight_kg ?? (item as any).weight_kg ?? null,
            total_weight_kg: item.total_weight_kg ?? ((item.unit_weight_kg ?? (item as any).weight_kg) && item.quantity ? Math.round(Number(item.unit_weight_kg ?? (item as any).weight_kg) * Number(item.quantity) * 1000) / 1000 : null),
            dimensions: item.dimensions || null,
          }));

          const { error: itemsError } = await supabase
            .from('quotation_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }

        // Execute independent post-creation operations concurrently
        const postTasks: Promise<any>[] = [
          autoSaveCustomProducts(items, queryClient, quotation.currency || 'INR', (quotation as any).exchange_rate || 1),
        ];

        if (quotation.lead_id) {
          postTasks.push(syncQuotationToEnquiryItems(quotation.lead_id, items, queryClient));
        }

        if (quotation.lead_id) {
          postTasks.push((async () => {
            if (quotation.created_by) {
              await supabase.from('activities').insert({
                lead_id: quotation.lead_id,
                user_id: quotation.created_by,
                activity_type: 'quotation',
                description: `Created quotation ${newQuotation.quotation_number}`,
                metadata: { quotation_id: newQuotation.id, quotation_number: newQuotation.quotation_number },
              });
            }

            // Always ensure lead has_enquiry: true, enquiry_status: 'quoted', and quoted_at set
            await supabase
              .from('leads')
              .update({ 
                last_activity_at: new Date().toISOString(),
                quoted_at: new Date().toISOString(),
                has_enquiry: true,
                enquiry_status: 'quoted'
              })
              .eq('id', quotation.lead_id);
          })());
        }

        await Promise.all(postTasks);

        recentQuotationCreations.set(dedupKey, { quotation: newQuotation, timestamp: Date.now() });
        setTimeout(() => {
          if (recentQuotationCreations.get(dedupKey)?.quotation?.id === newQuotation.id) {
            recentQuotationCreations.delete(dedupKey);
          }
        }, 5000);

        return newQuotation;
      })();

      inFlightQuotationCreations.set(dedupKey, createPromise);
      try {
        return await createPromise;
      } finally {
        inFlightQuotationCreations.delete(dedupKey);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation'] });
      if (data.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['activities', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['lead', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['lead-has-quotation', data.lead_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['spt-inbox'] });
      invalidateDashboardData(queryClient);
      toast.success('Quotation created successfully');
      logActivity({
        action: 'create',
        entityType: 'quotation',
        entityId: data.id,
        entityName: data.quotation_number,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create quotation: ' + error.message);
    },
  });
}

export function useUpdateQuotationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      sent_via,
    }: {
      id: string;
      status: string;
      sent_via?: string;
    }) => {
      const updates: Record<string, unknown> = { status };
      if (sent_via) {
        updates.sent_at = new Date().toISOString();
        updates.sent_via = sent_via;
      }

      const { data, error } = await supabase
        .from('quotations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation'] });
      if (data?.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['activities', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['lead', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['lead-has-quotation', data.lead_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['spt-inbox'] });
      invalidateDashboardData(queryClient);
    },
  });
}

export function useUpdateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      quotation,
      items,
      userId,
    }: {
      id: string;
      quotation: Partial<Quotation>;
      items: QuotationItem[];
      userId?: string;
    }) => {
      // STEP 1: Create a version snapshot BEFORE updating
      // Fetch current quotation with items for versioning
      const { data: currentQuotation, error: fetchError } = await supabase
        .from('quotations')
        .select(`
          *,
          items:quotation_items(*)
        `)
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Failed to fetch current quotation for versioning:', fetchError);
        // Continue with update even if versioning fails
      }

      // Get current max version number
      const { data: latestVersion } = await supabase
        .from('quotation_versions')
        .select('version_number')
        .eq('quotation_id', id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

      // Create version snapshot if we have current data
      if (currentQuotation && currentQuotation.items) {
        const itemsSnapshot = currentQuotation.items.map((item: any) => ({
          id: item.id,
          description: item.description,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          rate: item.rate,
          unit: item.unit,
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent,
          amount: item.amount,
          tax_amount: item.tax_amount,
          product_id: item.product_id
        }));

        await supabase.from('quotation_versions').insert({
          quotation_id: id,
          version_number: nextVersionNumber,
          created_by: userId || null,
          subject: currentQuotation.subject,
          notes: currentQuotation.notes,
          terms_conditions: currentQuotation.terms_conditions,
          subtotal: currentQuotation.subtotal,
          total_discount: currentQuotation.total_discount,
          total_tax: currentQuotation.total_tax,
          grand_total: currentQuotation.grand_total,
          valid_until: currentQuotation.valid_until,
          currency: currentQuotation.currency,
          exchange_rate: currentQuotation.exchange_rate,
          items_snapshot: itemsSnapshot
        });
      }

      // Ensure fresh session before update to prevent RLS failures
      await ensureFreshSession();

      // Determine effective lead_id and customer_id so they are never lost
      const effectiveLeadId = quotation.lead_id || currentQuotation?.lead_id;
      const effectiveCustomerId = quotation.customer_id || currentQuotation?.customer_id;

      // STEP 2: Update quotation
      // Determine new status - if updating from draft, default to pending
      const currentStatus = currentQuotation?.status || 'draft';
      const newStatus = quotation.status || (currentStatus === 'draft' ? 'pending' : currentStatus);
      
      console.log('[Quotation Update] Transitioning status:', {
        quotationId: id,
        currentStatus,
        requestedStatus: quotation.status,
        finalStatus: newStatus,
        leadId: effectiveLeadId,
      });

      const { error: quotationError } = await supabase
        .from('quotations')
        .update({
          lead_id: effectiveLeadId || null,
          customer_id: effectiveCustomerId || null,
          subject: quotation.subject,
          notes: quotation.notes,
          terms_conditions: quotation.terms_conditions,
          subtotal: quotation.subtotal,
          total_discount: quotation.total_discount,
          total_tax: quotation.total_tax,
          grand_total: quotation.grand_total,
          advance_percent: (quotation as any).advance_percent ?? null,
          advance_amount: (quotation as any).advance_amount ?? null,
          balance_amount: (quotation as any).balance_amount ?? null,
          payment_remark: (quotation as any).payment_remark ?? null,
          advance_remark: (quotation as any).advance_remark ?? null,
          balance_remark: (quotation as any).balance_remark ?? null,

          valid_until: quotation.valid_until,
          currency: quotation.currency || 'INR',
          exchange_rate: (quotation as any).exchange_rate || 1,
          status: newStatus,
          revision_number: nextVersionNumber + 1,
        })
        .eq('id', id);
      
      console.log('[Quotation Update] Status transition complete');

      if (quotationError) throw quotationError;

      // Delete existing items
      const { error: deleteError } = await supabase
        .from('quotation_items')
        .delete()
        .eq('quotation_id', id);

      if (deleteError) throw deleteError;

      // Insert new items with validated product IDs
      if (items.length > 0) {
        const { items: validatedItems, snapshots, floorAdjusted } = await prepareQuotationItems(items);
        if (floorAdjusted > 0) {
          toast.info(`${floorAdjusted} line item${floorAdjusted > 1 ? 's' : ''} raised to internal list-price floor.`);
        }

        const itemsToInsert = validatedItems.map((item, index) => ({
          ...snapshotFor(snapshots, item.product_id),
          quotation_id: id,
          product_id: item.product_id || null,
          enquiry_item_id: item.enquiry_item_id || null,
          description: item.description,
          hsn_code: item.hsn_code,
          model_number: (item as any).model_number || null,
          product_description: (item as any).product_description || null,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          target_rate: item.target_rate || null,
          discount_percent: item.discount_percent,
          discount_amount: item.discount_amount,
          tax_percent: item.tax_percent,
          tax_amount: item.tax_amount,
          amount: item.amount,
          sort_order: index,
          lead_time_days: item.lead_time_days || null,
          unit_weight_kg: item.unit_weight_kg ?? (item as any).weight_kg ?? null,
          total_weight_kg: item.total_weight_kg ?? ((item.unit_weight_kg ?? (item as any).weight_kg) && item.quantity ? Math.round(Number(item.unit_weight_kg ?? (item as any).weight_kg) * Number(item.quantity) * 1000) / 1000 : null),
          dimensions: item.dimensions || null,
        }));

        const { error: itemsError } = await supabase
          .from('quotation_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Execute independent post-update operations concurrently
      const postTasks: Promise<any>[] = [
        autoSaveCustomProducts(items, queryClient, quotation.currency || 'INR', (quotation as any).exchange_rate || 1),
      ];

      if (effectiveLeadId) {
        postTasks.push(syncQuotationToEnquiryItems(effectiveLeadId, items, queryClient));
      }

      if (effectiveLeadId) {
        postTasks.push((async () => {
          const authorId = userId || (quotation as any).created_by || currentQuotation?.created_by;
          if (authorId) {
            const qNumber = currentQuotation?.quotation_number || id;
            await supabase.from('activities').insert({
              lead_id: effectiveLeadId,
              user_id: authorId,
              activity_type: 'quotation',
              description: `Updated quotation ${qNumber}`,
              metadata: { quotation_id: id, quotation_number: qNumber, action: 'updated' },
            });
          }

          const leadUpdates: Record<string, any> = {
            last_activity_at: new Date().toISOString(),
          };
          // When quotation is active (not draft), ensure lead reflects quotation status and preserves enquiry
          if (newStatus !== 'draft') {
            leadUpdates.has_enquiry = true;
            leadUpdates.enquiry_status = 'quoted';
            if (!currentQuotation?.quoted_at) {
              leadUpdates.quoted_at = new Date().toISOString();
            }
          }

          await supabase
            .from('leads')
            .update(leadUpdates)
            .eq('id', effectiveLeadId);
        })());
      }

      await Promise.all(postTasks);

      return { id, lead_id: effectiveLeadId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation'] });
      queryClient.invalidateQueries({ queryKey: ['quotation-versions'] });
      if (data.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['activities', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['lead', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['lead-has-quotation', data.lead_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['spt-inbox'] });
      invalidateDashboardData(queryClient);
      toast.success('Quotation updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update quotation: ' + error.message);
    },
  });
}

export function useDeleteQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get quotation details for logging
      const { data: quotation } = await supabase
        .from('quotations')
        .select('quotation_number, lead_id')
        .eq('id', id)
        .single();

      // Soft delete using the database function
      const { error } = await supabase.rpc('soft_delete_quotation', { quotation_id: id });
      if (error) throw error;

      return { id, ...quotation };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-quotations'] });
      if (data.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['lead', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      }
      toast.success('Quotation moved to trash');
      logActivity({
        action: 'delete',
        entityType: 'quotation',
        entityId: data.id,
        entityName: data.quotation_number || 'Quotation',
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to delete quotation: ' + error.message);
    },
  });
}

export function useRestoreQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('restore_quotation', { quotation_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['deleted-quotations'] });
      toast.success('Quotation restored successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to restore quotation: ' + error.message);
    },
  });
}

export function useDeletedQuotations() {
  return useQuery({
    queryKey: ['deleted-quotations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotations')
        .select(`
          *,
          customer:customers(id, company_name, contact_person, phone, email),
          lead:leads(id, title)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return data as unknown as QuotationWithDetails[];
    },
  });
}

export function usePermanentDeleteQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('hard_delete_quotation', { quotation_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['deleted-quotations'] });
      toast.success('Quotation permanently deleted');
      logActivity({
        action: 'delete',
        entityType: 'quotation',
        entityId: id,
        metadata: { permanent: true },
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to permanently delete quotation: ' + error.message);
    },
  });
}

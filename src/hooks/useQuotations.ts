import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity-logger';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';
import { pickBestDescription, deriveModelNumber } from '@/lib/description-utils';
import { buildPriceSnapshots, snapshotFor } from '@/lib/quotation-snapshot';
import { normalizeModel } from '@/lib/model-normalize';

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
        .select('*')
        .eq('is_active', true)
        .order('name')
        .range(0, 99999); // Fetch up to 100,000 products
      if (error) throw error;
      return data as Product[];
    },
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
        .select('id, name, description, hsn_code, unit, default_rate, purchase_price, category, tax_rate, is_active, price_updated_at, price_updated_by, lead_time_days, model_number, brand, list_price, list_price_source, min_margin_pct, price_valid_until, product_status, sales_price, sales_discount_pct, purchase_discount_pct, replacement_model_no')
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
        .select('*, product:products(model_number, description, name)')
        .eq('quotation_id', id)
        .order('sort_order');

      if (itemsError) throw itemsError;

      // Flatten catalog print fields onto each item so PDF renderers can use them
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

  let updatedCount = 0;

  for (const qItem of items) {
    // First try to match by enquiry_item_id if set
    let matchId = qItem.enquiry_item_id;
    
    // If no direct link, match by product_id or by similar description
    if (!matchId) {
      const match = enquiryItems.find(ei => {
        // Match by product_id if both have it
        if (ei.matched_product_id && qItem.product_id && ei.matched_product_id === qItem.product_id) {
          return true;
        }
        // Match by description similarity
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

      // Sync target_rate if set
      if (qItem.target_rate && qItem.target_rate > 0) {
        updateData.target_rate = qItem.target_rate;
      }

      // Sync matched_product_id if quotation has product linked
      const enquiryItem = enquiryItems.find(ei => ei.id === matchId);
      if (qItem.product_id && enquiryItem && !enquiryItem.matched_product_id) {
        updateData.matched_product_id = qItem.product_id;
      }

      const { error } = await supabase
        .from('enquiry_items')
        .update(updateData)
        .eq('id', matchId);

      if (!error) {
        updatedCount++;
        
        // Also sync target_rate to any existing price_requests for this enquiry item
        if (qItem.target_rate && qItem.target_rate > 0) {
          await supabase
            .from('price_requests')
            .update({ target_rate: qItem.target_rate })
            .eq('enquiry_item_id', matchId);
        }
      }
    }
  }

  if (updatedCount > 0) {
    queryClient.invalidateQueries({ queryKey: ['enquiry-items', leadId] });
    queryClient.invalidateQueries({ queryKey: ['price-requests'] });
  }
}

// Helper function to auto-save custom items to product catalog
// NOTE: Does NOT update existing product prices - catalog prices are only changed via Products management
async function autoSaveCustomProducts(
  items: QuotationItem[],
  queryClient: ReturnType<typeof useQueryClient>,
  currency: string = 'INR',
  exchangeRate: number = 1
) {
  const customItems = items.filter(item => !item.product_id);
  const addedProducts: string[] = [];

  for (const item of customItems) {
    // Extract product name from description (first part before " - " or full text)
    const productName = item.description.includes(' - ') 
      ? item.description.split(' - ')[0].trim()
      : item.description.trim();

    if (!productName) continue;

    // Check if product already exists (case-insensitive)
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .ilike('name', productName)
      .maybeSingle();

    if (!existingProduct) {
      // Convert rate back to INR if quotation is in different currency
      // This ensures catalog prices are always stored in INR
      const rateInINR = currency !== 'INR' && exchangeRate > 0 && exchangeRate !== 1
        ? item.rate * exchangeRate
        : item.rate;

      // Create new product with rate in INR
      const tenantId = await requireTenantId();
      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          name: productName,
          description: item.description,
          hsn_code: item.hsn_code || null,
          unit: item.unit || 'Nos',
          default_rate: rateInINR || 0,
          tax_rate: item.tax_percent || 18,
          is_active: true,
          tenant_id: tenantId,
        } as any)
        .select()
        .single();

      if (!productError && newProduct) {
        addedProducts.push(productName);
      }
    }
  }

  if (addedProducts.length > 0) {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    toast.success(`${addedProducts.length} product(s) added to catalog: ${addedProducts.join(', ')}`);
  }
}

// Helper function to validate UUIDs
function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper function to validate product IDs exist in database
async function validateProductIds(items: QuotationItem[]): Promise<QuotationItem[]> {
  const productIds = items
    .map(item => item.product_id)
    .filter((id): id is string => !!id && isValidUUID(id));
  
  if (productIds.length === 0) return items;

  // Fetch existing product IDs
  const { data: existingProducts, error } = await supabase
    .from('products')
    .select('id')
    .in('id', productIds);

  if (error) {
    console.error('Failed to validate product IDs:', error);
    // On error, clear all product_ids to be safe
    return items.map(item => ({ ...item, product_id: null }));
  }

  const validIds = new Set(existingProducts?.map(p => p.id) || []);

  // Clear invalid product_ids
  return items.map(item => ({
    ...item,
    product_id: item.product_id && validIds.has(item.product_id) ? item.product_id : null
  }));
}

async function hydrateItemCatalogDescriptions(items: QuotationItem[]): Promise<QuotationItem[]> {
  const productIds = items
    .map(item => item.product_id)
    .filter((id): id is string => !!id && isValidUUID(id));

  if (productIds.length === 0) return items;

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, description, model_number')
    .in('id', productIds);

  if (error || !products) return items;

  const catalog = new Map(products.map(product => [product.id, product]));

  return items.map(item => {
    if (!item.product_id) return item;
    const product = catalog.get(item.product_id);
    if (!product) return item;

    const modelNumber = item.model_number || product.model_number || null;
    const catalogDescription = printableProductDescription(product as Product);
    const bestDescription = pickBestDescription(
      item.product_description || item.description,
      catalogDescription,
      modelNumber,
    );

    return {
      ...item,
      model_number: modelNumber,
      product_description: bestDescription || item.product_description || null,
      description: bestDescription || item.description,
    };
  });
}

/**
 * Enforce internal list-price floor across quotation items.
 * For every line linked to a product that has (list_price, min_margin_pct),
 * the rate is raised to max(entered, list_price * (1 - min_margin_pct/100)).
 * Amount, discount_amount and tax_amount are recomputed when the floor kicks in.
 * The list price itself is never persisted to the item / customer output.
 */
async function applyPriceFloors(items: QuotationItem[]): Promise<{ items: QuotationItem[]; adjusted: number }> {
  const productIds = items
    .map(i => i.product_id)
    .filter((id): id is string => !!id && isValidUUID(id));
  if (productIds.length === 0) return { items, adjusted: 0 };

  const { data: catalog, error } = await supabase
    .from('products')
    .select('id, list_price, min_margin_pct')
    .in('id', productIds);
  if (error || !catalog) return { items, adjusted: 0 };

  const map = new Map(catalog.map(p => [p.id, p]));
  let adjusted = 0;
  const next = items.map(item => {
    if (!item.product_id) return item;
    const p = map.get(item.product_id);
    const { floor, effectiveRate, floorApplied } = computePriceFloor(
      { list_price: p?.list_price ?? null, min_margin_pct: p?.min_margin_pct ?? null },
      Number(item.rate) || 0,
    );
    if (!floor || !floorApplied) return item;
    adjusted += 1;
    const rate = effectiveRate;
    const qty = Number(item.quantity) || 0;
    const gross = rate * qty;
    const discountAmount = Math.round(gross * ((Number(item.discount_percent) || 0) / 100) * 100) / 100;
    const taxable = gross - discountAmount;
    const taxAmount = Math.round(taxable * ((Number(item.tax_percent) || 0) / 100) * 100) / 100;
    const amount = Math.round((taxable + taxAmount) * 100) / 100;
    return { ...item, rate, discount_amount: discountAmount, tax_amount: taxAmount, amount };
  });
  return { items: next, adjusted };
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
      // Validate product IDs before inserting to prevent FK constraint errors
      const cleaned = await hydrateItemCatalogDescriptions(await validateProductIds(items));
      // Enforce internal list-price floor (e.g. Siemens LP × 40%) before persisting
      const { items: validatedItems, adjusted: floorAdjusted } = await applyPriceFloors(cleaned);
      if (floorAdjusted > 0) {
        toast.info(`${floorAdjusted} line item${floorAdjusted > 1 ? 's' : ''} raised to internal list-price floor.`);
      }

      // Ensure fresh session before insert to prevent RLS failures during token refresh
      await ensureFreshSession();
      const tenantId = await requireTenantId();
      const { data: newQuotation, error: quotationError } = await supabase
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

      // Create items with validated product IDs
      if (validatedItems.length > 0) {
        const snapshots = await buildPriceSnapshots(validatedItems.map((i) => i.product_id));
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
        }));

        const { error: itemsError } = await supabase
          .from('quotation_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Auto-save custom items to catalog (with INR conversion if needed)
      // NOTE: We do NOT sync existing product prices - catalog prices are managed via Products only
      await autoSaveCustomProducts(items, queryClient, quotation.currency || 'INR', (quotation as any).exchange_rate || 1);
      
      // Sync quotation data (target_rate, matched_product_id) back to enquiry items
      if (quotation.lead_id) {
        await syncQuotationToEnquiryItems(quotation.lead_id, items, queryClient);
      }

      // AUTO-LOG ACTIVITY: Log quotation creation as activity for escalation tracking
      if (quotation.lead_id && quotation.created_by) {
        await supabase.from('activities').insert({
          lead_id: quotation.lead_id,
          user_id: quotation.created_by,
          activity_type: 'quotation',
          description: `Created quotation ${newQuotation.quotation_number}`,
          metadata: { quotation_id: newQuotation.id, quotation_number: newQuotation.quotation_number },
        });

        // Update lead's last_activity_at and quoted_at (if first quotation)
        await supabase
          .from('leads')
          .update({ 
            last_activity_at: new Date().toISOString(),
            quoted_at: new Date().toISOString(),
            enquiry_status: 'quoted'
          })
          .eq('id', quotation.lead_id)
          .is('quoted_at', null);

        // Also update last_activity_at even if quoted_at was already set
        await supabase
          .from('leads')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', quotation.lead_id);
      }

      return newQuotation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['activities', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['lead', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-has-quotation', data.lead_id] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation'] });
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

      // STEP 2: Update quotation
      // Determine new status - if updating from draft, default to pending
      const currentStatus = currentQuotation?.status || 'draft';
      const newStatus = quotation.status || (currentStatus === 'draft' ? 'pending' : currentStatus);
      
      console.log('[Quotation Update] Transitioning status:', {
        quotationId: id,
        currentStatus,
        requestedStatus: quotation.status,
        finalStatus: newStatus,
      });

      const { error: quotationError } = await supabase
        .from('quotations')
        .update({
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
        // Validate product IDs before inserting to prevent FK constraint errors
        const cleaned = await hydrateItemCatalogDescriptions(await validateProductIds(items));
        const { items: validatedItems, adjusted: floorAdjusted } = await applyPriceFloors(cleaned);
        if (floorAdjusted > 0) {
          toast.info(`${floorAdjusted} line item${floorAdjusted > 1 ? 's' : ''} raised to internal list-price floor.`);
        }
        
        const snapshots = await buildPriceSnapshots(validatedItems.map((i) => i.product_id));
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
        }));

        const { error: itemsError } = await supabase
          .from('quotation_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Auto-save custom items to catalog (with INR conversion if needed)
      // NOTE: We do NOT sync existing product prices - catalog prices are managed via Products only
      await autoSaveCustomProducts(items, queryClient, quotation.currency || 'INR', (quotation as any).exchange_rate || 1);
      
      // Sync quotation data (target_rate, matched_product_id) back to enquiry items
      if (quotation.lead_id) {
        await syncQuotationToEnquiryItems(quotation.lead_id, items, queryClient);
      }

      // AUTO-LOG ACTIVITY: Log quotation update as activity for escalation tracking
      if (quotation.lead_id && userId) {
        // Fetch quotation number for logging
        const { data: quotationData } = await supabase
          .from('quotations')
          .select('quotation_number')
          .eq('id', id)
          .single();

        await supabase.from('activities').insert({
          lead_id: quotation.lead_id,
          user_id: userId,
          activity_type: 'quotation',
          description: `Updated quotation ${quotationData?.quotation_number || id}`,
          metadata: { quotation_id: id, action: 'updated' },
        });

        // Update lead's last_activity_at to prevent false escalation
        await supabase
          .from('leads')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', quotation.lead_id);
      }

      return { id, lead_id: quotation.lead_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotation'] });
      queryClient.invalidateQueries({ queryKey: ['quotation-versions'] });
      if (data.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['activities', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['lead', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      }
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

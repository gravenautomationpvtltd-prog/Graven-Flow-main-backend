import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Product } from './useQuotations';
import { logActivity } from '@/lib/activity-logger';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';
import { normalizeModel, splitModelList } from '@/lib/model-normalize';

// Infinite scroll hook for product search with server-side filtering
export function useProductsInfinite(search: string = '', pageSize: number = 100) {
  return useInfiniteQuery({
    queryKey: ['products-infinite', search],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      // Apply search filter if provided (model no, partial model, brand, description)
      if (search && search.trim()) {
        const term = search.trim();
        const searchTerm = `%${term}%`;
        const filters = [
          `name.ilike.${searchTerm}`,
          `hsn_code.ilike.${searchTerm}`,
          `description.ilike.${searchTerm}`,
          `model_number.ilike.${searchTerm}`,
          `brand.ilike.${searchTerm}`,
        ];
        for (const probe of splitModelList(term)) {
          const folded = normalizeModel(probe);
          if (folded.length >= 2) filters.push(`search_key.ilike.%${folded}%`);
        }
        query = query.or(filters.join(','));
      }

      query = query.range(from, to);

      const { data, error } = await query;
      if (error) throw error;

      return {
        products: data as Product[],
        nextPage: data.length === pageSize ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });
}

type ProductInsert = Omit<Product, 'id' | 'price_updated_at' | 'price_updated_by'> & { id?: string; lead_time_days?: number | null; preferred_supplier_id?: string | null; price_valid_until?: string | null };
type ProductUpdate = Omit<Product, 'price_updated_at' | 'price_updated_by'> & { lead_time_days?: number | null; preferred_supplier_id?: string | null; price_valid_until?: string | null };

/**
 * Lifecycle, single-list-price and logistics fields are optional on the form
 * payload, so only send the ones actually provided. Weight is always KG and
 * dimensions are always CM — no unit selection anywhere in the app.
 */
const EXTRA_PRODUCT_FIELDS = [
  'model_number',
  'brand',
  'product_status',
  'replacement_model_no',
  'list_price',
  'sales_discount_pct',
  'purchase_discount_pct',
  'sales_price',
  'min_margin_pct',
  'weight_kg',
  'length_cm',
  'width_cm',
  'height_cm',
] as const;

function pickExtraProductFields(input: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const k of EXTRA_PRODUCT_FIELDS) if (k in input) out[k] = (input as any)[k] ?? null;
  return out;
}

export interface ProductWithUpdater extends Product {
  price_updater?: { full_name: string } | null;
  creator?: { full_name: string } | null;
  editor?: { full_name: string } | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export function useProductsAdmin(
  page: number = 1,
  pageSize: number = 500,
  search?: string,
  status?: 'all' | 'active' | 'discontinued' | 'obsolete',
  createdBy?: string,
  updatedBy?: string,
) {
  return useQuery({
    queryKey: ['products-admin', page, pageSize, search, status, createdBy, updatedBy],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          price_updater:profiles!products_price_updated_by_fkey(full_name),
          creator:profiles!products_created_by_fkey(full_name),
          editor:profiles!products_updated_by_fkey(full_name)
        `, { count: 'exact' })
        .order('name');

      if (createdBy && createdBy !== 'all') query = query.eq('created_by', createdBy);
      if (updatedBy && updatedBy !== 'all') query = query.eq('updated_by', updatedBy);

      // Apply search filter if provided (model no, partial model, brand, description)
      if (search && search.trim()) {
        const term = search.trim();
        const filters = [
          `name.ilike.%${term}%`,
          `hsn_code.ilike.%${term}%`,
          `description.ilike.%${term}%`,
          `model_number.ilike.%${term}%`,
          `brand.ilike.%${term}%`,
        ];
        // Folded key: ignores case, spaces, dashes, commas and O/0, I/1, L/1
        for (const probe of splitModelList(term)) {
          const folded = normalizeModel(probe);
          if (folded.length >= 2) filters.push(`search_key.ilike.%${folded}%`);
        }
        query = query.or(filters.join(','));
      }

      if (status && status !== 'all') {
        query = query.eq('product_status', status);
      }

      // Apply pagination using range
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return { products: data as ProductWithUpdater[], totalCount: count ?? 0 };
    },
  });
}

export function useBulkImportProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (products: { name: string; hsn_code?: string }[]) => {
      await ensureFreshSession();
      const tenantId = await requireTenantId();
      const { data, error } = await supabase
        .from('products')
        .insert(
          products.map((p) => ({
            name: p.name.trim(),
            hsn_code: p.hsn_code?.trim() || null,
            is_active: true,
            unit: 'Nos',
            default_rate: 0,
            tax_rate: 18,
            tenant_id: tenantId,
          } as any))
        )
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products-admin'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`${data.length} products imported successfully`);
    },
    onError: (error: Error) => {
      toast.error('Failed to import products: ' + error.message);
    },
  });
}

// Guard against saving a model number another product already owns: the database
// enforces (tenant_id, model_number) uniqueness and its raw error is unreadable.
async function assertModelNumberFree(
  tenantId: string,
  modelNumber: string | null | undefined,
  excludeId?: string,
) {
  const typed = (modelNumber || '').trim();
  if (!typed) return;

  // The DB constraint is (tenant_id, model_number) exact-match, so the pre-check
  // must use the same rule (case-insensitive). The folded match_key is for search,
  // NOT for blocking saves — it would wrongly reject thousands of coexisting codes
  // that differ only by dashes/spaces (e.g. 6SL3210-5FB10-4UF1 vs 6SL32105FB104UF1).
  const pattern = typed.replace(/[\\%_]/g, (c) => `\\${c}`);
  let query = supabase
    .from('products')
    .select('id, model_number, name')
    .eq('tenant_id', tenantId)
    .ilike('model_number', pattern)
    .limit(5);
  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) return; // never block a save because the pre-check itself failed
  const clash = (data || []).find(
    (row: any) => (row.model_number || '').trim().toUpperCase() === typed.toUpperCase(),
  );
  if (clash) {
    throw new Error(
      `Model number "${typed}" is already used by another product (${(clash as any).model_number || (clash as any).name}). Open that product to edit it, or use a different model number.`,
    );
  }
}

function friendlyProductError(error: any): Error {
  const msg = String(error?.message || error);
  if (error?.code === '23505' || msg.includes('products_tenant_model_number_key')) {
    return new Error(
      'That model number already exists in the catalogue. Open the existing product to edit it, or use a different model number.',
    );
  }
  return error instanceof Error ? error : new Error(msg);
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: ProductInsert) => {
      await ensureFreshSession();
      const tenantId = await requireTenantId();
      await assertModelNumberFree(tenantId, (product as any).model_number ?? product.name);
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: product.name,
          description: product.description,
          hsn_code: product.hsn_code,
          unit: product.unit,
          default_rate: product.default_rate,
          purchase_price: product.purchase_price,
          category: product.category,
          tax_rate: product.tax_rate,
          is_active: product.is_active ?? true,
          lead_time_days: product.lead_time_days ?? null,
          preferred_supplier_id: product.preferred_supplier_id ?? null,
          price_valid_until: product.price_valid_until ?? null,
          tenant_id: tenantId,
          ...pickExtraProductFields(product),
        } as any)
        .select()
        .single();

      if (error) throw friendlyProductError(error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products-admin'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created successfully');
      logActivity({
        action: 'create',
        entityType: 'product',
        entityId: data.id,
        entityName: data.name,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create product: ' + error.message);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ProductUpdate) => {
      await ensureFreshSession();
      if ('model_number' in (updates as any) && (updates as any).model_number) {
        // Only check for a clash when the code actually changed — an untouched
        // model number can never clash with itself.
        const { data: current } = await supabase
          .from('products')
          .select('model_number')
          .eq('id', id)
          .maybeSingle();
        const unchanged =
          (current?.model_number || '').trim().toUpperCase() ===
          String((updates as any).model_number).trim().toUpperCase();
        if (!unchanged) {
          const tenantId = await requireTenantId();
          await assertModelNumberFree(tenantId, (updates as any).model_number, id);
        }
      }
      const { data, error } = await supabase
        .from('products')
        .update({
          name: updates.name,
          description: updates.description,
          hsn_code: updates.hsn_code,
          unit: updates.unit,
          default_rate: updates.default_rate,
          purchase_price: updates.purchase_price,
          category: updates.category,
          tax_rate: updates.tax_rate,
          is_active: updates.is_active,
          lead_time_days: updates.lead_time_days ?? null,
          preferred_supplier_id: updates.preferred_supplier_id ?? null,
          price_valid_until: updates.price_valid_until ?? null,
          ...pickExtraProductFields(updates),
        } as any)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw friendlyProductError(error);
      if (!data) throw new Error('Product not found or update failed');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products-admin'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['product-detail', data.id] });
      queryClient.invalidateQueries({ queryKey: ['product-price-versions', data.id] });
      toast.success('Product updated successfully');
      logActivity({
        action: 'update',
        entityType: 'product',
        entityId: data.id,
        entityName: data.name,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to update product: ' + error.message);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['products-admin'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted successfully');
      logActivity({
        action: 'delete',
        entityType: 'product',
        entityId: id,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to delete product: ' + error.message);
    },
  });
}

export interface ListPriceRow {
  model_number: string;
  description: string | null;
  hsn_code: string | null;
  list_price: number;
}

export interface ImportListPricesInput {
  rows: ListPriceRow[];
  sourceLabel: string;
  brand: string;
  defaultDiscountPct: number;
}

export function useImportListPrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rows, sourceLabel, brand, defaultDiscountPct }: ImportListPricesInput) => {
      await ensureFreshSession();
      const tenantId = await requireTenantId();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const filename = `list-prices/${tenantId}/${Date.now()}.json`;
      const jsonBlob = new Blob([JSON.stringify(rows)], { type: 'application/json' });

      const { error: uploadErr } = await supabase.storage
        .from('list-price-imports')
        .upload(filename, jsonBlob, { contentType: 'application/json' });
      if (uploadErr) throw uploadErr;

      const { data, error } = await supabase.functions.invoke('import-list-prices', {
        body: {
          bucket: 'list-price-imports',
          path: filename,
          tenant_id: tenantId,
          source_label: sourceLabel,
          brand,
          default_discount_pct: defaultDiscountPct,
          uploaded_by: user.id,
        },
      });
      if (error) throw error;
      return data as { ok: boolean; rows_parsed: number; upserted: number; skipped: number; rejected_samples?: any[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-admin'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to import list prices: ' + error.message);
    },
  });
}

export function useExtractListPricePdf() {
  return useMutation({
    mutationFn: async ({ file, brand }: { file: File; brand: string }) => {
      await ensureFreshSession();
      const tenantId = await requireTenantId();

      const filename = `price-pdfs/${tenantId}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('list-price-imports')
        .upload(filename, file, { contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data, error } = await supabase.functions.invoke('extract-list-price-pdf', {
        body: {
          bucket: 'list-price-imports',
          path: filename,
          tenant_id: tenantId,
          brand,
        },
      });
      if (error) throw error;
      return (data ?? { rows: [] }) as { ok: boolean; rows: ListPriceRow[]; count: number };
    },
    onError: (error: Error) => {
      toast.error('Failed to extract PDF: ' + error.message);
    },
  });
}


/** Procurement extends how long an existing catalog price stays quotable. */
export function useExtendPriceValidity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, validUntil }: { id: string; validUntil: string }) => {
      await ensureFreshSession();
      const { error } = await supabase
        .from('products')
        .update({ price_valid_until: validUntil } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-admin'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'] });
      toast.success('Price validity extended');
    },
    onError: (e: Error) => toast.error('Failed to extend validity: ' + e.message),
  });
}

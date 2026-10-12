import { supabase } from '@/integrations/supabase/client';
function getActiveVerticalId(): string | null {
  try {
    return typeof window !== 'undefined'
      ? localStorage.getItem('graven.activeVerticalId')
      : null;
  } catch {
    return null;
  }
}

export interface POItemPayload {
  product_id?: string | null;
  description: string;
  hsn_code?: string | null;
  quantity: number;
  rate: number;
  tax_percent?: number;
  tax_amount?: number;
  amount?: number;
  received_quantity?: number;
  sort_order?: number;
}

export interface POCreationPayload {
  supplier_id?: string | null;
  sales_order_id?: string | null;
  lead_id?: string | null;
  quotation_id?: string | null;
  supplier_quotation_id?: string | null;
  order_date?: string | null;
  expected_delivery?: string | null;
  notes?: string | null;
  terms_conditions?: string | null;
  currency?: string | null;
  exchange_rate?: number | null;
  vertical_id?: string | null;
  idempotency_key?: string | null;
  items: POItemPayload[];
}

// In-flight promise cache to deduplicate simultaneous/parallel submissions
const inFlightPOPromises = new Map<string, Promise<any>>();

// Short-lived cache of recently completed POs (20 seconds) to handle immediate retries / double-clicks
const recentPOCache = new Map<string, { po: any; timestamp: number }>();

/**
 * Generates a deterministic deduplication key for a PO creation attempt.
 */
export function generatePODedupKey(poData: POCreationPayload, userId?: string): string {
  if (poData.idempotency_key) {
    return `key:${poData.idempotency_key}`;
  }
  const sup = poData.supplier_id || 'nosup';
  const so = poData.sales_order_id || 'noso';
  const itemsSig = (poData.items || [])
    .map((i) => `${i.product_id || i.description || ''}:${i.quantity}:${i.rate}`)
    .sort()
    .join('|');
  return `po:${userId || 'anon'}:${sup}:${so}:${itemsSig}`;
}

/**
 * Purges recent cache entries older than maxAgeMs (default 20s).
 */
function cleanupRecentPOCache(maxAgeMs = 20000) {
  const now = Date.now();
  for (const [key, val] of recentPOCache.entries()) {
    if (now - val.timestamp > maxAgeMs) {
      recentPOCache.delete(key);
    }
  }
}

/**
 * Creates a purchase order with full idempotency guarantees:
 * 1. Checks short-lived completion cache for instant repeat submissions.
 * 2. Checks in-flight Promise map to merge concurrent parallel executions.
 * 3. Uses atomic backend RPC `create_purchase_order_secure` with advisory locking.
 * 4. Falls back to direct insert with DB-level unique constraint on `idempotency_key`.
 */
export async function createPurchaseOrderIdempotent(
  poData: POCreationPayload,
  userId?: string
): Promise<any> {
  cleanupRecentPOCache();

  const dedupKey = generatePODedupKey(poData, userId);

  // 1. Check if recently created (within 20s)
  const recent = recentPOCache.get(dedupKey);
  if (recent && Date.now() - recent.timestamp < 20000) {
    return recent.po;
  }

  // 2. Check in-flight promise map
  if (inFlightPOPromises.has(dedupKey)) {
    return inFlightPOPromises.get(dedupKey);
  }

  const effectiveKey = poData.idempotency_key || `po_${userId || 'user'}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const createPromise = (async () => {
    const verticalId = poData.vertical_id || getActiveVerticalId();
    const payload = {
      ...poData,
      created_by: userId || null,
      idempotency_key: effectiveKey,
      vertical_id: verticalId,
    };

    // Attempt backend RPC
    try {
      const { data: rpcPo, error: rpcError } = await (supabase as any).rpc('create_purchase_order_secure', {
        payload,
      });

      if (!rpcError && rpcPo) {
        recentPOCache.set(dedupKey, { po: rpcPo, timestamp: Date.now() });
        return rpcPo;
      }
      if (rpcError && rpcError.code !== '42883') {
        // If not "function does not exist", inspect if it's already created
        if (rpcError.message?.includes('duplicate key') || rpcError.code === '23505') {
          const { data: existing } = await supabase
            .from('purchase_orders')
            .select()
            .eq('idempotency_key', effectiveKey)
            .maybeSingle();
          if (existing) {
            recentPOCache.set(dedupKey, { po: existing, timestamp: Date.now() });
            return existing;
          }
        }
        throw rpcError;
      }
    } catch (err: any) {
      if (err?.message?.includes('duplicate key') || err?.code === '23505') {
        const { data: existing } = await supabase
          .from('purchase_orders')
          .select()
          .eq('idempotency_key', effectiveKey)
          .maybeSingle();
        if (existing) {
          recentPOCache.set(dedupKey, { po: existing, timestamp: Date.now() });
          return existing;
        }
      }
      // If error is not a missing-function error, rethrow
      if (err?.code !== '42883') {
        throw err;
      }
    }

    // Direct fallback with idempotency check
    const { items, ...poFields } = poData;
    let subtotal = 0;
    let totalTax = 0;
    items.forEach((item) => {
      const itemAmount = item.quantity * item.rate;
      const taxAmount = (itemAmount * (item.tax_percent || 0)) / 100;
      subtotal += itemAmount;
      totalTax += taxAmount;
    });

    // Check if PO with this idempotency_key already exists
    const { data: existing } = await supabase
      .from('purchase_orders')
      .select()
      .eq('idempotency_key', effectiveKey)
      .maybeSingle();

    if (existing) {
      recentPOCache.set(dedupKey, { po: existing, timestamp: Date.now() });
      return existing;
    }

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        ...poFields,
        po_number: '',
        created_by: userId,
        subtotal,
        total_tax: totalTax,
        grand_total: subtotal + totalTax,
        vertical_id: verticalId,
        idempotency_key: effectiveKey,
      } as any)
      .select()
      .single();

    if (poError) {
      if (poError.code === '23505') {
        const { data: recheck } = await supabase
          .from('purchase_orders')
          .select()
          .eq('idempotency_key', effectiveKey)
          .maybeSingle();
        if (recheck) {
          recentPOCache.set(dedupKey, { po: recheck, timestamp: Date.now() });
          return recheck;
        }
      }
      throw poError;
    }

    // Insert line items
    const itemsWithPoId = items.map((item, index) => {
      const itemAmount = item.quantity * item.rate;
      const taxAmount = (itemAmount * (item.tax_percent || 0)) / 100;
      return {
        po_id: po.id,
        product_id: item.product_id,
        description: item.description,
        hsn_code: item.hsn_code,
        quantity: item.quantity,
        rate: item.rate,
        tax_percent: item.tax_percent || 18,
        tax_amount: taxAmount,
        amount: itemAmount + taxAmount,
        received_quantity: 0,
        sort_order: index,
      };
    });

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemsWithPoId);

    if (itemsError) throw itemsError;

    // Auto-update sales order status to 'in_procurement' if linked
    if (poFields.sales_order_id) {
      await supabase
        .from('sales_orders')
        .update({ status: 'in_procurement' })
        .eq('id', poFields.sales_order_id)
        .in('status', ['ready_for_procurement', 'pending_documents']);
    }

    recentPOCache.set(dedupKey, { po, timestamp: Date.now() });
    return po;
  })();

  inFlightPOPromises.set(dedupKey, createPromise);

  try {
    const result = await createPromise;
    return result;
  } finally {
    inFlightPOPromises.delete(dedupKey);
  }
}

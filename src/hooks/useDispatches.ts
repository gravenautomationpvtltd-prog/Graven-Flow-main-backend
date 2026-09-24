import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity-logger';

export interface DispatchItem {
  id: string;
  dispatch_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  sort_order: number;
  created_at: string;
  /** Snapshot at dispatch time — always KG */
  unit_weight_kg?: number | null;
  /** Snapshot at dispatch time — always CM */
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  model_number?: string | null;
}

/**
 * Copies model number, weight (KG) and dimensions (CM) from the catalogue onto
 * the dispatch lines so a packing list stays accurate even if the product changes later.
 */
async function withLogisticsSnapshot(
  items: Array<{ product_id: string | null; description: string; quantity: number }>,
  dispatchId: string,
) {
  const ids = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean))) as string[];
  const byId = new Map<string, any>();
  if (ids.length) {
    const { data } = await supabase
      .from('products')
      .select('id, model_number, weight_kg, length_cm, width_cm, height_cm')
      .in('id', ids);
    for (const p of data ?? []) byId.set(p.id as string, p);
  }
  return items.map((item, index) => {
    const p = item.product_id ? byId.get(item.product_id) : null;
    return {
      dispatch_id: dispatchId,
      product_id: item.product_id,
      description: item.description,
      quantity: item.quantity,
      sort_order: index,
      model_number: p?.model_number ?? null,
      unit_weight_kg: p?.weight_kg ?? null,
      length_cm: p?.length_cm ?? null,
      width_cm: p?.width_cm ?? null,
      height_cm: p?.height_cm ?? null,
    };
  });
}

/**
 * Takes dispatched quantities out of warehouse stock so Ready Stock stays honest.
 * Deducts from the user's own office when it holds the item, otherwise from the
 * warehouse with the most stock. Products with no stock line are skipped; a
 * shortfall is recorded in the movement note instead of blocking the dispatch.
 */
async function deductStockForDispatch(
  items: Array<{ product_id: string | null; quantity: number }>,
  dispatchId: string,
) {
  const productIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean))) as string[];
  if (productIds.length === 0) return;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  let userOfficeId: string | null = null;
  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('office_id').eq('id', userId).maybeSingle();
    userOfficeId = (profile?.office_id as string | null) ?? null;
  }

  const { data: rows } = await supabase
    .from('inventory')
    .select('id, product_id, office_id, quantity')
    .in('product_id', productIds);

  for (const item of items) {
    if (!item.product_id || !item.quantity) continue;
    const candidates = (rows || []).filter((r) => r.product_id === item.product_id);
    if (candidates.length === 0) continue;

    const row =
      candidates.find((r) => r.office_id === userOfficeId) ??
      [...candidates].sort((a, b) => Number(b.quantity) - Number(a.quantity))[0];

    const qty = Math.abs(Number(item.quantity));
    const shortfall = Math.max(0, qty - Number(row.quantity));
    const newQty = Math.max(0, Number(row.quantity) - qty);

    await supabase.from('inventory').update({ quantity: newQty }).eq('id', row.id);
    await supabase.from('stock_movements').insert({
      inventory_id: row.id,
      product_id: item.product_id,
      office_id: row.office_id,
      movement_type: 'out',
      quantity: qty,
      reference_type: 'dispatch',
      reference_id: dispatchId,
      notes: shortfall > 0 ? `Dispatched — ${shortfall} more than available stock` : 'Dispatched',
      created_by: userId,
    });
  }
}

export interface Dispatch {
  id: string;
  dispatch_number: string;
  quotation_id: string | null;
  customer_id: string | null;
  lead_id: string | null;
  status: string;
  dispatch_date: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  shipping_address: string | null;
  notes: string | null;
  dispatched_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    company_name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  quotation?: {
    id: string;
    quotation_number: string;
  } | null;
  items?: DispatchItem[];
}

type DispatchItemInsert = Omit<DispatchItem, 'id' | 'created_at' | 'dispatch_id'>;

interface CreateDispatchData {
  quotation_id?: string | null;
  customer_id: string | null;
  lead_id?: string | null;
  sales_order_id?: string | null;
  dispatch_date?: string | null;
  courier_name?: string | null;
  tracking_number?: string | null;
  shipping_address?: string | null;
  notes?: string | null;
  items: DispatchItemInsert[];
}

export function useDispatches() {
  return useQuery({
    queryKey: ['dispatches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispatches')
        .select(`
          *,
          customer:customers(id, company_name, contact_person, phone, email),
          quotation:quotations!dispatches_quotation_id_fkey(id, quotation_number)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Dispatch[];
    },
  });
}

export function useDispatch(id: string | undefined) {
  return useQuery({
    queryKey: ['dispatches', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispatches')
        .select(`
          *,
          customer:customers(id, company_name, contact_person, phone, email, address, city, state, pincode),
          quotation:quotations!dispatches_quotation_id_fkey(id, quotation_number),
          items:dispatch_items(*)
        `)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as Dispatch | null;
    },
  });
}

/**
 * Goods only leave the warehouse once Quality Control has released the order.
 * QC and leadership can release-and-dispatch in one go.
 */
async function assertOrderReleased(salesOrderId: string | null | undefined, userId: string | undefined) {
  if (!salesOrderId) return;

  const { data: order } = await supabase
    .from('sales_orders')
    .select('order_number, qc_released_at')
    .eq('id', salesOrderId)
    .maybeSingle();

  if (!order || order.qc_released_at) return;

  // A part release by QC is enough to let the warehouse hand goods over
  const { count } = await supabase
    .from('qc_release_items')
    .select('id', { count: 'exact', head: true })
    .eq('sales_order_id', salesOrderId);
  if ((count ?? 0) > 0) return;

  const { data: roleRows } = await supabase.from('user_roles').select('role').eq('user_id', userId ?? '');
  const roles = (roleRows || []).map((r) => r.role as string);
  const canOverride = roles.some((r) => ['qc', 'super_admin', 'coo', 'manager'].includes(r));

  if (!canOverride) {
    throw new Error(
      `Order ${order.order_number} has not been released by Quality Control yet. Ask QC to release the goods first.`,
    );
  }

  await supabase
    .from('sales_orders')
    .update({ qc_released_at: new Date().toISOString(), qc_released_by: userId })
    .eq('id', salesOrderId);
}

/** Stock already left the warehouse when QC released it — don't take it twice. */
async function orderHasQCRelease(salesOrderId: string | null | undefined) {
  if (!salesOrderId) return false;
  const { count } = await supabase
    .from('qc_release_items')
    .select('id', { count: 'exact', head: true })
    .eq('sales_order_id', salesOrderId);
  return (count ?? 0) > 0;
}


export function useCreateDispatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dispatchData: CreateDispatchData) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { items, ...dispatchFields } = dispatchData;

      await assertOrderReleased(dispatchData.sales_order_id, userId);

      const { data: dispatch, error: dispatchError } = await supabase
        .from('dispatches')
        .insert({
          ...dispatchFields,
          dispatch_number: '',
          dispatched_by: userId,
        })
        .select()
        .single();

      if (dispatchError) throw dispatchError;

      // Insert line items
      if (items.length > 0) {
        const itemsWithDispatchId = await withLogisticsSnapshot(items, dispatch.id);

        const { error: itemsError } = await supabase
          .from('dispatch_items')
          .insert(itemsWithDispatchId);

        if (itemsError) throw itemsError;

        // Stock leaves the warehouse with the goods (unless QC already took it out at release)
        try {
          if (!(await orderHasQCRelease(dispatchData.sales_order_id))) {
            await deductStockForDispatch(items, dispatch.id);
          }

        } catch (e) {
          console.error('Stock deduction failed for dispatch', dispatch.id, e);
        }
      }

      return dispatch;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      if (variables.sales_order_id) {
        queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
        queryClient.invalidateQueries({ queryKey: ['sales-order-by-lead'] });
        queryClient.invalidateQueries({ queryKey: ['linked-dispatches', variables.sales_order_id] });
      }
      toast.success('Dispatch created successfully');
      logActivity({
        action: 'create',
        entityType: 'dispatch',
        entityId: data.id,
        entityName: data.dispatch_number,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create dispatch: ' + error.message);
    },
  });
}

export function useUpdateDispatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, items, ...updates }: { id: string; items?: DispatchItemInsert[] } & Partial<Dispatch>) => {
      const { data, error } = await supabase
        .from('dispatches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update line items if provided
      if (items) {
        // Delete existing items
        await supabase.from('dispatch_items').delete().eq('dispatch_id', id);
        
        // Insert new items
        if (items.length > 0) {
          const itemsWithDispatchId = await withLogisticsSnapshot(items, id);

          const { error: itemsError } = await supabase
            .from('dispatch_items')
            .insert(itemsWithDispatchId);

          if (itemsError) throw itemsError;
        }
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      toast.success('Dispatch updated successfully');
      logActivity({
        action: 'update',
        entityType: 'dispatch',
        entityId: data.id,
        entityName: data.dispatch_number,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to update dispatch: ' + error.message);
    },
  });
}

export function useUpdateDispatchStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, courier_name, tracking_number }: { 
      id: string; 
      status: string;
      courier_name?: string;
      tracking_number?: string;
    }) => {
      const updates: Record<string, unknown> = { status };
      
      if (status === 'shipped' || status === 'in_transit') {
        if (courier_name) updates.courier_name = courier_name;
        if (tracking_number) updates.tracking_number = tracking_number;
        if (!updates.dispatch_date) updates.dispatch_date = new Date().toISOString().split('T')[0];
      }

      const { data, error } = await supabase
        .from('dispatches')
        .update(updates)
        .eq('id', id)
        .select('*, sales_order_id')
        .single();

      if (error) throw error;

      // Auto-update sales order to 'fulfilled' when dispatch is delivered
      if (status === 'delivered' && data.sales_order_id) {
        await supabase
          .from('sales_orders')
          .update({ status: 'fulfilled' })
          .eq('id', data.sales_order_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order-by-lead'] });
      queryClient.invalidateQueries({ queryKey: ['linked-dispatches'] });
      toast.success('Dispatch status updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update status: ' + error.message);
    },
  });
}

export function useDeleteDispatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dispatches')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      toast.success('Dispatch deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete dispatch: ' + error.message);
    },
  });
}

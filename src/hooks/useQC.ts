import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PendingPOItem {
  id: string;
  product_id: string | null;
  quantity: number;
  received_quantity: number | null;
  product?: { id: string; name: string; model_number: string | null; unit: string | null } | null;
}

export interface PendingPO {
  id: string;
  po_number: string;
  supplier_id: string | null;
  status: string;
  expected_delivery: string | null;
  created_at: string;
  supplier?: { id: string; name: string } | null;
  items?: PendingPOItem[];
}

/** Purchase orders that still have material to be received and checked. */
export function usePendingReceipts() {
  return useQuery({
    queryKey: ['qc', 'pending-receipts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id, po_number, supplier_id, status, expected_delivery, created_at,
          supplier:suppliers(id, name),
          items:purchase_order_items(
            id, product_id, quantity, received_quantity,
            product:products(id, name, model_number, unit)
          )
        `)
        .in('status', ['approved', 'sent', 'acknowledged', 'partial', 'pending_verification', 'delivered', 'in_transit'])
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      return ((data || []) as unknown as PendingPO[]).filter((po) =>
        (po.items || []).some((i) => Number(i.received_quantity || 0) < Number(i.quantity || 0)),
      );
    },
  });
}


export interface ReceiveLine {
  po_item_id: string;
  product_id: string | null;
  ordered_quantity: number;
  received_quantity: number;
  passed_quantity: number;
  held_quantity: number;
  hold_reason?: string;
}

interface ReceiveMaterialInput {
  po_id: string;
  supplier_id: string | null;
  office_id: string;
  notes?: string;
  items: ReceiveLine[];
}

/** Records the receipt, the quality check and the stock update in one action. */
export function useReceiveMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReceiveMaterialInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      const now = new Date().toISOString();

      const lines = input.items.filter((i) => Number(i.received_quantity) > 0);
      if (lines.length === 0) throw new Error('Enter at least one received quantity');

      const totalHeld = lines.reduce((s, i) => s + Number(i.held_quantity || 0), 0);
      const totalPassed = lines.reduce((s, i) => s + Number(i.passed_quantity || 0), 0);
      const qcStatus = totalHeld === 0 ? 'passed' : totalPassed === 0 ? 'held' : 'partial';

      const { data: grn, error: grnError } = await supabase
        .from('goods_receipt_notes')
        .insert({
          po_id: input.po_id,
          supplier_id: input.supplier_id,
          grn_number: '',
          received_by: userId,
          received_date: now.split('T')[0],
          status: 'verified',
          notes: input.notes || null,
          qc_status: qcStatus,
          qc_by: userId,
          qc_at: now,
          qc_notes: input.notes || null,
        })
        .select()
        .single();

      if (grnError) throw grnError;

      const { error: itemsError } = await supabase.from('grn_items').insert(
        lines.map((i) => ({
          grn_id: grn.id,
          po_item_id: i.po_item_id,
          product_id: i.product_id,
          ordered_quantity: i.ordered_quantity,
          received_quantity: i.received_quantity,
          accepted_quantity: i.passed_quantity,
          rejected_quantity: i.held_quantity,
          rejection_reason: i.held_quantity > 0 ? i.hold_reason || 'Failed quality check' : null,
        })),
      );
      if (itemsError) throw itemsError;

      for (const line of lines) {
        // Keep the purchase order's received quantity in step
        const { data: poItem } = await supabase
          .from('purchase_order_items')
          .select('received_quantity')
          .eq('id', line.po_item_id)
          .maybeSingle();

        await supabase
          .from('purchase_order_items')
          .update({ received_quantity: Number(poItem?.received_quantity || 0) + Number(line.received_quantity) })
          .eq('id', line.po_item_id);

        if (!line.product_id) continue;

        const { data: existing } = await supabase
          .from('inventory')
          .select('id, quantity, held_quantity')
          .eq('product_id', line.product_id)
          .eq('office_id', input.office_id)
          .maybeSingle();

        let inventoryId = existing?.id as string | undefined;

        if (existing) {
          await supabase
            .from('inventory')
            .update({
              quantity: Number(existing.quantity || 0) + Number(line.passed_quantity || 0),
              held_quantity: Number(existing.held_quantity || 0) + Number(line.held_quantity || 0),
              last_restocked_at: line.passed_quantity > 0 ? now : undefined,
            })
            .eq('id', existing.id);
        } else {
          const { data: created, error: invError } = await supabase
            .from('inventory')
            .insert({
              product_id: line.product_id,
              office_id: input.office_id,
              quantity: line.passed_quantity || 0,
              held_quantity: line.held_quantity || 0,
              last_restocked_at: now,
            })
            .select('id')
            .single();
          if (invError) throw invError;
          inventoryId = created.id;
        }

        if (Number(line.passed_quantity) > 0) {
          await supabase.from('stock_movements').insert({
            inventory_id: inventoryId,
            product_id: line.product_id,
            office_id: input.office_id,
            movement_type: 'in',
            quantity: line.passed_quantity,
            reference_type: 'grn',
            reference_id: grn.id,
            notes: `Received & QC passed — ${grn.grn_number || 'GRN'}`,
            created_by: userId,
          });
        }

        if (Number(line.held_quantity) > 0) {
          await supabase.from('stock_movements').insert({
            inventory_id: inventoryId,
            product_id: line.product_id,
            office_id: input.office_id,
            movement_type: 'hold',
            quantity: line.held_quantity,
            reference_type: 'qc_hold',
            reference_id: grn.id,
            notes: `Held at QC — ${line.hold_reason || 'Failed quality check'}`,
            created_by: userId,
          });
        }
      }

      return grn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['ready-stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Material received and checked');
    },
    onError: (error: Error) => toast.error('Could not record the receipt: ' + error.message),
  });
}

export interface HeldStockRow {
  id: string;
  product_id: string;
  office_id: string;
  quantity: number;
  held_quantity: number;
  updated_at: string;
  product?: { id: string; name: string; model_number: string | null; unit: string | null } | null;
  office?: { id: string; name: string } | null;
}

/** Material set aside at the quality check — never sellable. */
export function useHeldStock() {
  return useQuery({
    queryKey: ['qc', 'held-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id, product_id, office_id, quantity, held_quantity, updated_at,
          product:products(id, name, model_number, unit),
          office:offices(id, name)
        `)
        .gt('held_quantity', 0)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as HeldStockRow[];
    },
  });
}

/** Move held material into sellable stock, or write it off (returned / scrapped). */
export function useResolveHeldStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      inventory_id: string;
      product_id: string;
      office_id: string;
      quantity: number;
      action: 'release' | 'writeoff';
      notes?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data: row, error: rowError } = await supabase
        .from('inventory')
        .select('id, quantity, held_quantity')
        .eq('id', input.inventory_id)
        .single();
      if (rowError) throw rowError;

      const qty = Math.min(Math.abs(input.quantity), Number(row.held_quantity || 0));
      if (qty <= 0) throw new Error('Nothing held to action');

      await supabase
        .from('inventory')
        .update({
          held_quantity: Number(row.held_quantity || 0) - qty,
          quantity: input.action === 'release' ? Number(row.quantity || 0) + qty : Number(row.quantity || 0),
          last_restocked_at: input.action === 'release' ? new Date().toISOString() : undefined,
        })
        .eq('id', input.inventory_id);

      await supabase.from('stock_movements').insert({
        inventory_id: input.inventory_id,
        product_id: input.product_id,
        office_id: input.office_id,
        movement_type: input.action === 'release' ? 'in' : 'writeoff',
        quantity: qty,
        reference_type: input.action === 'release' ? 'qc_release' : 'qc_writeoff',
        notes:
          (input.action === 'release' ? 'Released into stock after QC' : 'Written off from held material') +
          (input.notes ? ` — ${input.notes}` : ''),
        created_by: userId,
      });

      return { success: true };
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['qc'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['ready-stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-ledger'] });
      toast.success(v.action === 'release' ? 'Material moved into stock' : 'Material written off');
    },
    onError: (error: Error) => toast.error('Could not update held material: ' + error.message),
  });
}

export interface ReleaseOrderRow {
  id: string;
  order_number: string;
  status: string;
  order_value: number | null;
  created_at: string;
  qc_released_at: string | null;
  qc_released_by: string | null;
  customer?: { id: string; company_name: string } | null;
  releaser?: { id: string; full_name: string } | null;
}

/** Billed orders waiting for the warehouse to be allowed to hand the goods over. */
export function useOrdersForRelease(released = false) {
  return useQuery({
    queryKey: ['qc', 'release-orders', released],
    queryFn: async () => {
      let query = supabase
        .from('sales_orders')
        .select(`
          id, order_number, status, order_value, created_at, qc_released_at, qc_released_by,
          customer:customers(id, company_name),
          releaser:profiles!sales_orders_qc_released_by_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      query = released ? query.not('qc_released_at', 'is', null) : query.is('qc_released_at', null);
      if (!released) query = query.in('status', ['ready_to_dispatch', 'fulfilled', 'partially_fulfilled']);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ReleaseOrderRow[];
    },
  });
}

export function useReleaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { order_id: string; notes?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('sales_orders')
        .update({
          qc_released_at: new Date().toISOString(),
          qc_released_by: userData.user?.id,
          qc_release_notes: input.notes || null,
        })
        .eq('id', input.order_id);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Order released for dispatch');
    },
    onError: (error: Error) => toast.error('Could not release the order: ' + error.message),
  });
}

/* ------------------------------------------------------------------ */
/* Direct receipt — material that arrives without a purchase order      */
/* ------------------------------------------------------------------ */

export interface DirectReceiptLine {
  product_id: string;
  received_quantity: number;
  passed_quantity: number;
  held_quantity: number;
  hold_reason?: string;
}

/**
 * Receives material that is not on a purchase order (replacements, customer
 * returns, opening stock). Writes straight to warehouse stock and the ledger.
 */
export function useDirectReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      office_id: string;
      supplier_id?: string | null;
      reference?: string;
      notes?: string;
      items: DirectReceiptLine[];
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      const now = new Date().toISOString();

      const lines = input.items.filter((i) => i.product_id && Number(i.received_quantity) > 0);
      if (lines.length === 0) throw new Error('Add at least one item with a received quantity');

      const label = [input.reference, input.notes].filter(Boolean).join(' — ');

      for (const line of lines) {
        const { data: existing } = await supabase
          .from('inventory')
          .select('id, quantity, held_quantity')
          .eq('product_id', line.product_id)
          .eq('office_id', input.office_id)
          .maybeSingle();

        let inventoryId = existing?.id as string | undefined;

        if (existing) {
          await supabase
            .from('inventory')
            .update({
              quantity: Number(existing.quantity || 0) + Number(line.passed_quantity || 0),
              held_quantity: Number(existing.held_quantity || 0) + Number(line.held_quantity || 0),
              last_restocked_at: line.passed_quantity > 0 ? now : undefined,
            })
            .eq('id', existing.id);
        } else {
          const { data: created, error: invError } = await supabase
            .from('inventory')
            .insert({
              product_id: line.product_id,
              office_id: input.office_id,
              quantity: line.passed_quantity || 0,
              held_quantity: line.held_quantity || 0,
              last_restocked_at: now,
            })
            .select('id')
            .single();
          if (invError) throw invError;
          inventoryId = created.id;
        }

        if (Number(line.passed_quantity) > 0) {
          await supabase.from('stock_movements').insert({
            inventory_id: inventoryId,
            product_id: line.product_id,
            office_id: input.office_id,
            movement_type: 'in',
            quantity: line.passed_quantity,
            reference_type: 'direct_receipt',
            notes: `Direct receipt${label ? ` — ${label}` : ''}`,
            created_by: userId,
          });
        }

        if (Number(line.held_quantity) > 0) {
          await supabase.from('stock_movements').insert({
            inventory_id: inventoryId,
            product_id: line.product_id,
            office_id: input.office_id,
            movement_type: 'hold',
            quantity: line.held_quantity,
            reference_type: 'qc_hold',
            notes: `Held at QC — ${line.hold_reason || 'Failed quality check'}`,
            created_by: userId,
          });
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['ready-stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-ledger'] });
      toast.success('Material received into the warehouse');
    },
    onError: (error: Error) => toast.error('Could not record the receipt: ' + error.message),
  });
}

/* ------------------------------------------------------------------ */
/* Receipt history                                                      */
/* ------------------------------------------------------------------ */

export function useQCReceipts() {
  return useQuery({
    queryKey: ['qc', 'receipts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goods_receipt_notes')
        .select(`
          id, grn_number, received_date, status, qc_status, qc_at, notes,
          supplier:suppliers(id, name),
          po:purchase_orders(id, po_number),
          checker:profiles!goods_receipt_notes_qc_by_fkey(id, full_name),
          items:grn_items(id, received_quantity, accepted_quantity, rejected_quantity)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as Array<{
        id: string;
        grn_number: string;
        received_date: string;
        status: string;
        qc_status: string | null;
        qc_at: string | null;
        notes: string | null;
        supplier?: { id: string; name: string } | null;
        po?: { id: string; po_number: string } | null;
        checker?: { id: string; full_name: string } | null;
        items?: Array<{ received_quantity: number; accepted_quantity: number | null; rejected_quantity: number | null }>;
      }>;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Line-by-line release against the invoice (or quotation)              */
/* ------------------------------------------------------------------ */

export interface ReleaseLine {
  source_type: 'invoice' | 'quotation';
  source_item_id: string;
  product_id: string | null;
  description: string;
  unit: string | null;
  ordered_quantity: number;
  released_quantity: number;
  available_quantity: number;
}

export interface OrderReleaseDetail {
  invoice_id: string | null;
  invoice_number: string | null;
  quotation_id: string | null;
  lines: ReleaseLine[];
}

/** The items on an order, with how much QC has already released and what is in stock. */
export function useOrderReleaseLines(orderId: string | null) {
  return useQuery({
    queryKey: ['qc', 'release-lines', orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<OrderReleaseDetail> => {
      const { data: order, error: orderError } = await supabase
        .from('sales_orders')
        .select('id, quotation_id')
        .eq('id', orderId!)
        .single();
      if (orderError) throw orderError;

      const { data: invoice } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('sales_order_id', orderId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let source: 'invoice' | 'quotation' = 'quotation';
      let raw: Array<{ id: string; product_id: string | null; description: string | null; quantity: number; unit: string | null }> = [];

      if (invoice?.id) {
        const { data } = await supabase
          .from('invoice_items')
          .select('id, product_id, description, quantity, unit')
          .eq('invoice_id', invoice.id);
        if ((data || []).length > 0) {
          source = 'invoice';
          raw = data as typeof raw;
        }
      }

      if (raw.length === 0 && order.quotation_id) {
        const { data } = await supabase
          .from('quotation_items')
          .select('id, product_id, description, quantity, unit, model_number')
          .eq('quotation_id', order.quotation_id);
        raw = (data || []).map((i: any) => ({
          id: i.id,
          product_id: i.product_id,
          description: i.model_number || i.description,
          quantity: i.quantity,
          unit: i.unit,
        }));
      }

      const { data: releasedRows } = await supabase
        .from('qc_release_items')
        .select('source_item_id, product_id, quantity')
        .eq('sales_order_id', orderId!);

      const releasedByItem = new Map<string, number>();
      for (const r of releasedRows || []) {
        const key = (r.source_item_id as string) || (r.product_id as string) || '';
        releasedByItem.set(key, (releasedByItem.get(key) || 0) + Number(r.quantity || 0));
      }

      const productIds = raw.map((r) => r.product_id).filter(Boolean) as string[];
      const stockByProduct = new Map<string, number>();
      if (productIds.length > 0) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('product_id, quantity')
          .in('product_id', productIds);
        for (const row of inv || []) {
          stockByProduct.set(
            row.product_id as string,
            (stockByProduct.get(row.product_id as string) || 0) + Number(row.quantity || 0),
          );
        }
      }

      return {
        invoice_id: invoice?.id ?? null,
        invoice_number: invoice?.invoice_number ?? null,
        quotation_id: order.quotation_id ?? null,
        lines: raw.map((r) => ({
          source_type: source,
          source_item_id: r.id,
          product_id: r.product_id,
          description: r.description || 'Item',
          unit: r.unit,
          ordered_quantity: Number(r.quantity || 0),
          released_quantity: releasedByItem.get(r.id) || 0,
          available_quantity: r.product_id ? stockByProduct.get(r.product_id) || 0 : 0,
        })),
      };
    },
  });
}

/** Releases the entered quantities, taking them out of warehouse stock there and then. */
export function useReleaseOrderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      order_id: string;
      invoice_id: string | null;
      quotation_id: string | null;
      office_id: string | null;
      notes?: string;
      lines: Array<{
        source_type: 'invoice' | 'quotation';
        source_item_id: string;
        product_id: string | null;
        description: string;
        quantity: number;
        ordered_quantity: number;
        released_quantity: number;
      }>;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const lines = input.lines.filter((l) => Number(l.quantity) > 0);
      if (lines.length === 0) throw new Error('Enter at least one quantity to release');

      const { data: release, error: releaseError } = await supabase
        .from('qc_releases')
        .insert({
          sales_order_id: input.order_id,
          invoice_id: input.invoice_id,
          quotation_id: input.quotation_id,
          office_id: input.office_id,
          notes: input.notes || null,
          released_by: userId,
        })
        .select('id')
        .single();
      if (releaseError) throw releaseError;

      const { error: itemsError } = await supabase.from('qc_release_items').insert(
        lines.map((l) => ({
          release_id: release.id,
          sales_order_id: input.order_id,
          product_id: l.product_id,
          source_type: l.source_type,
          source_item_id: l.source_item_id,
          description: l.description,
          quantity: l.quantity,
          office_id: input.office_id,
        })),
      );
      if (itemsError) throw itemsError;

      // Stock leaves the warehouse at release time
      for (const line of lines) {
        if (!line.product_id) continue;
        const { data: rows } = await supabase
          .from('inventory')
          .select('id, office_id, quantity')
          .eq('product_id', line.product_id);
        const candidates = rows || [];
        if (candidates.length === 0) continue;
        const row =
          candidates.find((r) => r.office_id === input.office_id) ??
          [...candidates].sort((a, b) => Number(b.quantity) - Number(a.quantity))[0];

        const qty = Math.abs(Number(line.quantity));
        const shortfall = Math.max(0, qty - Number(row.quantity || 0));
        await supabase
          .from('inventory')
          .update({ quantity: Math.max(0, Number(row.quantity || 0) - qty) })
          .eq('id', row.id);
        await supabase.from('stock_movements').insert({
          inventory_id: row.id,
          product_id: line.product_id,
          office_id: row.office_id,
          movement_type: 'out',
          quantity: qty,
          reference_type: 'qc_release_dispatch',
          reference_id: release.id,
          notes: shortfall > 0 ? `Released by QC — ${shortfall} more than available stock` : 'Released by QC for dispatch',
          created_by: userId,
        });
      }

      // Fully released? stamp the order so the warehouse can dispatch the lot
      const fullyReleased = input.lines.every(
        (l) => Number(l.released_quantity) + Number(l.quantity || 0) >= Number(l.ordered_quantity),
      );
      if (fullyReleased) {
        await supabase
          .from('sales_orders')
          .update({
            qc_released_at: new Date().toISOString(),
            qc_released_by: userId,
            qc_release_notes: input.notes || null,
          })
          .eq('id', input.order_id);
      }

      return { fullyReleased };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['qc'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['ready-stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-ledger'] });
      toast.success(res.fullyReleased ? 'Order fully released for dispatch' : 'Quantities released — balance still pending');
    },
    onError: (error: Error) => toast.error('Could not release the goods: ' + error.message),
  });
}

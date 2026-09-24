import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity-logger';

/** Read the active vertical id from the same storage key VerticalContext writes. */
function getActiveVerticalId(): string | null {
  try {
    return typeof window !== 'undefined'
      ? localStorage.getItem('graven.activeVerticalId')
      : null;
  } catch {
    return null;
  }
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  product_id: string | null;
  description: string;
  hsn_code: string | null;
  quantity: number;
  rate: number;
  tax_percent: number;
  tax_amount: number;
  amount: number;
  received_quantity: number;
  sort_order: number;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string | null;
  lead_id: string | null;
  quotation_id: string | null;
  status: string;
  order_date: string | null;
  expected_delivery: string | null;
  subtotal: number;
  total_tax: number;
  grand_total: number;
  currency: string | null;
  exchange_rate: number | null;
  notes: string | null;
  terms_conditions: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  authorized_by: string | null;
  authorized_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  review_requested_by: string | null;
  review_requested_at: string | null;
  review_suggestions: string | null;
  created_at: string;
  updated_at: string;
  supplier?: {
    id: string;
    name: string;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
    gst_number: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  } | null;
  items?: PurchaseOrderItem[];
  // Accountability profiles
  creator?: { id: string; full_name: string } | null;
  verifier?: { id: string; full_name: string } | null;
  authorizer?: { id: string; full_name: string } | null;
  approver?: { id: string; full_name: string } | null;
  rejector?: { id: string; full_name: string } | null;
  review_requester?: { id: string; full_name: string } | null;
}

type POItemInsert = Omit<PurchaseOrderItem, 'id' | 'created_at' | 'po_id'>;

interface CreatePOData {
  supplier_id: string | null;
  sales_order_id?: string | null;
  lead_id?: string | null;
  quotation_id?: string | null;
  order_date?: string | null;
  expected_delivery?: string | null;
  notes?: string | null;
  terms_conditions?: string | null;
  currency?: string | null;
  exchange_rate?: number | null;
  items: POItemInsert[];
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(id, name, contact_person, email, phone, gst_number),
          creator:profiles!purchase_orders_created_by_fkey(id, full_name),
          verifier:profiles!purchase_orders_verified_by_fkey(id, full_name),
          authorizer:profiles!purchase_orders_authorized_by_fkey(id, full_name),
          approver:profiles!purchase_orders_approved_by_fkey(id, full_name),
          rejector:profiles!purchase_orders_rejected_by_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PurchaseOrder[];
    },
  });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['purchase-orders', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(id, name, contact_person, email, phone, gst_number, address, city, state, pincode),
          items:purchase_order_items(*),
          creator:profiles!purchase_orders_created_by_fkey(id, full_name),
          verifier:profiles!purchase_orders_verified_by_fkey(id, full_name),
          authorizer:profiles!purchase_orders_authorized_by_fkey(id, full_name),
          approver:profiles!purchase_orders_approved_by_fkey(id, full_name),
          rejector:profiles!purchase_orders_rejected_by_fkey(id, full_name),
          review_requester:profiles!purchase_orders_review_requested_by_fkey(id, full_name)
        `)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as PurchaseOrder | null;
    },
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (poData: CreatePOData) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { items, ...poFields } = poData;

      // Calculate totals
      let subtotal = 0;
      let totalTax = 0;
      items.forEach(item => {
        const itemAmount = item.quantity * item.rate;
        const taxAmount = (itemAmount * (item.tax_percent || 0)) / 100;
        subtotal += itemAmount;
        totalTax += taxAmount;
      });

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          ...poFields,
          po_number: '',
          created_by: userId,
          subtotal,
          total_tax: totalTax,
          grand_total: subtotal + totalTax,
          vertical_id: getActiveVerticalId(),
        } as any)
        .select()
        .single();

      if (poError) throw poError;

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

      return po;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      if (variables.sales_order_id) {
        queryClient.invalidateQueries({ queryKey: ['sales-order-by-lead'] });
        queryClient.invalidateQueries({ queryKey: ['linked-pos', variables.sales_order_id] });
      }
      toast.success('Purchase order created successfully');
      logActivity({
        action: 'create',
        entityType: 'purchase_order',
        entityId: data.id,
        entityName: data.po_number,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create purchase order: ' + error.message);
    },
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, items, ...updates }: { id: string; items?: POItemInsert[] } & Partial<Omit<PurchaseOrder, 'items'>>) => {
      // Calculate totals if items provided
      let updateData: Record<string, unknown> = { ...updates };
      
      if (items) {
        let subtotal = 0;
        let totalTax = 0;
        items.forEach(item => {
          const itemAmount = item.quantity * item.rate;
          const taxAmount = (itemAmount * (item.tax_percent || 0)) / 100;
          subtotal += itemAmount;
          totalTax += taxAmount;
        });
        updateData = {
          ...updateData,
          subtotal,
          total_tax: totalTax,
          grand_total: subtotal + totalTax,
        };
      }

      const { data, error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update line items if provided
      if (items) {
        // Delete existing items
        await supabase.from('purchase_order_items').delete().eq('po_id', id);
        
        // Insert new items
        const itemsWithPoId = items.map((item, index) => {
          const itemAmount = item.quantity * item.rate;
          const taxAmount = (itemAmount * (item.tax_percent || 0)) / 100;
          return {
            po_id: id,
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
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order updated successfully');
      logActivity({
        action: 'update',
        entityType: 'purchase_order',
        entityId: data.id,
        entityName: data.po_number,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to update purchase order: ' + error.message);
    },
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Get any GRNs linked to this PO to delete their items first
      const { data: grns } = await supabase
        .from('goods_receipt_notes')
        .select('id')
        .eq('po_id', id);
      
      // 2. Delete GRN items for each GRN
      if (grns && grns.length > 0) {
        const grnIds = grns.map(g => g.id);
        await supabase.from('grn_items').delete().in('grn_id', grnIds);
      }
      
      // 3. Delete related records in order (most dependent first)
      await supabase.from('email_logs').delete().eq('po_id', id);
      await supabase.from('supplier_ratings').delete().eq('po_id', id);
      await supabase.from('supplier_payments').delete().eq('po_id', id);
      await supabase.from('goods_receipt_notes').delete().eq('po_id', id);
      await supabase.from('purchase_order_items').delete().eq('po_id', id);
      
      // 4. Finally delete the purchase order
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-ratings'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      toast.success('Purchase order deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete purchase order: ' + error.message);
    },
  });
}

// Helper to send notifications to approvers
async function notifyApprovers(poId: string, poNumber: string, grandTotal: number, supplierName: string, stage: string) {
  const { data: approverRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', ['manager', 'coo', 'super_admin']);

  if (rolesError) {
    console.error('Failed to fetch approvers:', rolesError);
    return;
  }

  if (approverRoles && approverRoles.length > 0) {
    const notificationType = stage.toLowerCase().includes('verification') 
      ? 'po_verification' 
      : stage.toLowerCase().includes('authorization') 
        ? 'po_authorization' 
        : 'po_approval';

    const notifications = approverRoles.map(({ user_id }) => ({
      user_id,
      title: `PO ${stage}`,
      message: `${poNumber} for ${supplierName} (₹${grandTotal.toLocaleString()}) requires ${stage.toLowerCase()}`,
      type: notificationType,
      link: `/procurement?po=${poId}`,
      metadata: { po_id: poId, po_number: poNumber, stage },
    }));

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifError) {
      console.error('Failed to create notifications:', notifError);
    }
  }
}

// Helper to notify creator
async function notifyCreator(creatorId: string, poNumber: string, message: string, poId: string) {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: creatorId,
      title: `PO Update: ${poNumber}`,
      message,
      type: 'info',
      link: `/procurement?po=${poId}`,
      metadata: { po_id: poId, po_number: poNumber },
    });

  if (error) {
    console.error('Failed to notify creator:', error);
  }
}

export function useSubmitForApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: po, error } = await supabase
        .from('purchase_orders')
        .update({ status: 'pending_verification' })
        .eq('id', id)
        .select('po_number, grand_total, supplier:suppliers(name)')
        .single();

      if (error) throw error;

      const supplierName = (po.supplier as { name: string } | null)?.name || 'Unknown Supplier';
      await notifyApprovers(id, po.po_number, po.grand_total, supplierName, 'Pending Verification');

      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order submitted for verification');
    },
    onError: (error: Error) => {
      toast.error('Failed to submit for approval: ' + error.message);
    },
  });
}

export function useVerifyPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data: po, error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'pending_authorization',
          verified_by: userId,
          verified_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('po_number, grand_total, supplier:suppliers(name)')
        .single();

      if (error) throw error;

      const supplierName = (po.supplier as { name: string } | null)?.name || 'Unknown Supplier';
      await notifyApprovers(id, po.po_number, po.grand_total, supplierName, 'Pending Authorization');

      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order verified');
    },
    onError: (error: Error) => {
      toast.error('Failed to verify purchase order: ' + error.message);
    },
  });
}

export function useAuthorizePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data: po, error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'pending_approval',
          authorized_by: userId,
          authorized_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('po_number, grand_total, supplier:suppliers(name)')
        .single();

      if (error) throw error;

      const supplierName = (po.supplier as { name: string } | null)?.name || 'Unknown Supplier';
      await notifyApprovers(id, po.po_number, po.grand_total, supplierName, 'Pending Approval');

      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order authorized');
    },
    onError: (error: Error) => {
      toast.error('Failed to authorize purchase order: ' + error.message);
    },
  });
}

export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data, error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'approved',
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('po_number, created_by')
        .single();

      if (error) throw error;

      // Notify creator
      if (data.created_by) {
        await notifyCreator(data.created_by, data.po_number, 'Your purchase order has been approved', id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order approved');
    },
    onError: (error: Error) => {
      toast.error('Failed to approve purchase order: ' + error.message);
    },
  });
}

export function useRejectPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data, error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'rejected',
          rejected_by: userId,
          rejected_at: new Date().toISOString(),
          notes: reason,
        })
        .eq('id', id)
        .select('po_number, created_by')
        .single();

      if (error) throw error;

      // Notify creator
      if (data.created_by) {
        await notifyCreator(data.created_by, data.po_number, `Your purchase order was rejected: ${reason}`, id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order rejected');
    },
    onError: (error: Error) => {
      toast.error('Failed to reject purchase order: ' + error.message);
    },
  });
}

export function useSendForReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, suggestions }: { id: string; suggestions: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data, error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'under_review',
          review_requested_by: userId,
          review_requested_at: new Date().toISOString(),
          review_suggestions: suggestions,
        })
        .eq('id', id)
        .select('po_number, created_by')
        .single();

      if (error) throw error;

      // Notify creator
      if (data.created_by) {
        await notifyCreator(data.created_by, data.po_number, `Your purchase order needs revision: ${suggestions}`, id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order sent for review');
    },
    onError: (error: Error) => {
      toast.error('Failed to send for review: ' + error.message);
    },
  });
}

export function useResubmitAfterReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: po, error } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'pending_verification',
          review_requested_by: null,
          review_requested_at: null,
          review_suggestions: null,
        })
        .eq('id', id)
        .select('po_number, grand_total, supplier:suppliers(name)')
        .single();

      if (error) throw error;

      const supplierName = (po.supplier as { name: string } | null)?.name || 'Unknown Supplier';
      await notifyApprovers(id, po.po_number, po.grand_total, supplierName, 'Resubmitted for Verification');

      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order resubmitted for verification');
    },
    onError: (error: Error) => {
      toast.error('Failed to resubmit: ' + error.message);
    },
  });
}

interface CreatePOFromQuotationData {
  quotationId: string;
  rfqId: string;
  poData: CreatePOData & { supplier_quotation_id?: string };
}

export function useCreatePOFromQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quotationId, rfqId, poData }: CreatePOFromQuotationData) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { items, ...poFields } = poData;

      // Calculate totals
      let subtotal = 0;
      let totalTax = 0;
      items.forEach(item => {
        const itemAmount = item.quantity * item.rate;
        const taxAmount = (itemAmount * (item.tax_percent || 0)) / 100;
        subtotal += itemAmount;
        totalTax += taxAmount;
      });

      // 1. Create the PO
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          ...poFields,
          po_number: '',
          created_by: userId,
          subtotal,
          total_tax: totalTax,
          grand_total: subtotal + totalTax,
          supplier_quotation_id: quotationId,
          vertical_id: getActiveVerticalId(),
        } as any)
        .select()
        .single();

      if (poError) throw poError;

      // 2. Insert line items
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

      // 3. Update awarded quotation status to 'accepted'
      await supabase
        .from('supplier_quotations')
        .update({ status: 'accepted' })
        .eq('id', quotationId);

      // 4. Reject other quotations for the same RFQ
      await supabase
        .from('supplier_quotations')
        .update({ status: 'rejected' })
        .eq('rfq_id', rfqId)
        .neq('id', quotationId)
        .not('status', 'in', '("rejected","withdrawn")');

      // 5. Update RFQ status to 'awarded'
      await supabase
        .from('rfqs')
        .update({ status: 'awarded' })
        .eq('id', rfqId);

      return po;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      toast.success('Purchase order created from quotation');
      logActivity({
        action: 'create',
        entityType: 'purchase_order',
        entityId: data.id,
        entityName: data.po_number,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create PO from quotation: ' + error.message);
    },
  });
}

export function useClonePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceId: string) => {
      // Fetch the source PO with items
      const { data: sourcePO, error: fetchError } = await supabase
        .from('purchase_orders')
        .select('*, items:purchase_order_items(*)')
        .eq('id', sourceId)
        .single();

      if (fetchError) throw fetchError;

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // Create new PO — inherit source vertical, falling back to active.
      const { data: newPO, error: createError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: '',
          supplier_id: sourcePO.supplier_id,
          order_date: new Date().toISOString().split('T')[0],
          expected_delivery: null,
          subtotal: sourcePO.subtotal,
          total_tax: sourcePO.total_tax,
          grand_total: sourcePO.grand_total,
          notes: sourcePO.notes,
          terms_conditions: sourcePO.terms_conditions,
          created_by: userId,
          status: 'draft',
          vertical_id: (sourcePO as any).vertical_id ?? getActiveVerticalId(),
        } as any)
        .select()
        .single();

      if (createError) throw createError;

      // Clone items
      if (sourcePO.items && sourcePO.items.length > 0) {
        const clonedItems = sourcePO.items.map((item: any) => ({
          po_id: newPO.id,
          product_id: item.product_id,
          description: item.description,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          rate: item.rate,
          tax_percent: item.tax_percent,
          tax_amount: item.tax_amount,
          amount: item.amount,
          received_quantity: 0,
          sort_order: item.sort_order,
        }));

        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(clonedItems);

        if (itemsError) throw itemsError;
      }

      return newPO;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order cloned successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to clone purchase order: ' + error.message);
    },
  });
}

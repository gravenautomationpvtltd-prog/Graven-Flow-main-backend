import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { logActivity } from '@/lib/activity-logger';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';

export interface SalesOrder {
  id: string;
  order_number: string;
  lead_id: string | null;
  quotation_id: string | null;
  customer_id: string | null;
  status: 'pending_documents' | 'ready_for_procurement' | 'in_procurement' | 'partially_fulfilled' | 'ready_to_dispatch' | 'fulfilled' | 'cancelled' | 'postponed';
  cancellation_reason: string | null;
  postponed_until: string | null;
  status_change_reason: string | null;
  order_value: number;
  payment_status: 'pending' | 'partial' | 'received';
  payment_amount: number;
  notes: string | null;
  created_by: string | null;
  assigned_procurement: string | null;
  is_import: boolean;
  preferred_supplier_id: string | null;
  expected_arrival: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkedPOSummary {
  supplier_name: string;
  expected_delivery: string | null;
}

export interface SalesOrderWithDetails extends SalesOrder {
  /** Net Sales (excl GST/tax): quotation.subtotal - quotation.total_discount, falling back to order_value */
  net_value?: number;
  lead?: {
    id: string;
    title: string;
  } | null;
  quotation?: {
    id: string;
    quotation_number: string;
    grand_total: number;
    subtotal?: number | null;
    total_discount?: number | null;
  } | null;
  customer?: {
    id: string;
    company_name: string;
    contact_person?: string | null;
    phone?: string;
    email?: string | null;
  } | null;
  creator?: {
    id: string;
    full_name: string;
  } | null;
  assigned_procurement_profile?: {
    id: string;
    full_name: string;
  } | null;
  preferred_supplier?: {
    id: string;
    name: string;
  } | null;
  linked_po_summary?: LinkedPOSummary[];
}

/** Compute Net Sales: quotation.subtotal - discount, fallback to gross order_value. */
export function computeNetValue(order: {
  order_value?: number | null;
  quotation?: { subtotal?: number | null; total_discount?: number | null } | null;
}): number {
  const sub = order.quotation?.subtotal;
  if (sub != null) {
    return Math.max(0, Number(sub) - Number(order.quotation?.total_discount || 0));
  }
  return Number(order.order_value || 0);
}

export interface OrderDocument {
  id: string;
  sales_order_id: string;
  document_type: 'customer_po' | 'payment_receipt' | 'other';
  file_name: string;
  file_url: string;
  uploaded_by: string | null;
  created_at: string;
}

export function useSalesOrders(status?: SalesOrder['status'] | 'all') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['sales-orders', status, user?.id],
    queryFn: async () => {
      const baseQuery = supabase
        .from('sales_orders')
        .select(`
          *,
          lead:leads(id, title),
          quotation:quotations!sales_orders_quotation_id_fkey(id, quotation_number, grand_total, subtotal, total_discount),
          customer:customers(id, company_name),
          creator:profiles!sales_orders_created_by_fkey(id, full_name),
          assigned_procurement_profile:profiles!sales_orders_assigned_procurement_fkey(id, full_name),
          preferred_supplier:suppliers!sales_orders_preferred_supplier_id_fkey(id, name)
        `)
        .order('created_at', { ascending: false });

      // Use filter instead of eq to avoid strict type checking
      const query = status && status !== 'all' 
        ? baseQuery.filter('status', 'eq', status)
        : baseQuery;

      const { data: orders, error } = await query;
      if (error) throw error;
      
      // Fetch linked PO summary for all orders
      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const { data: linkedPOs } = await supabase
          .from('purchase_orders')
          .select(`
            sales_order_id,
            expected_delivery,
            supplier_id
          `)
          .in('sales_order_id', orderIds);
        
        // Get unique supplier IDs
        const supplierIds = [...new Set((linkedPOs || []).map(po => po.supplier_id).filter(Boolean))];
        let suppliersMap: Record<string, string> = {};
        
        if (supplierIds.length > 0) {
          const { data: suppliers } = await supabase
            .from('suppliers')
            .select('id, name')
            .in('id', supplierIds as string[]);
          suppliersMap = (suppliers || []).reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>);
        }
        
        // Map PO summary + net_value to orders
        return orders.map(order => {
          const orderPOs = (linkedPOs || []).filter(po => po.sales_order_id === order.id);
          const linked_po_summary: LinkedPOSummary[] = orderPOs.map(po => ({
            supplier_name: po.supplier_id ? suppliersMap[po.supplier_id] || 'Unknown' : 'Unknown',
            expected_delivery: po.expected_delivery,
          }));
          const enriched = { ...order, linked_po_summary } as SalesOrderWithDetails;
          enriched.net_value = computeNetValue(enriched);
          return enriched;
        });
      }

      return (orders || []).map((o: any) => ({ ...o, net_value: computeNetValue(o) })) as SalesOrderWithDetails[];
    },
    enabled: !!user?.id,
  });
}

export function useSalesOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['sales-order', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          lead:leads(id, title),
          quotation:quotations!sales_orders_quotation_id_fkey(id, quotation_number, grand_total, subtotal, total_discount),
          customer:customers(id, company_name, contact_person, phone, email),
          creator:profiles!sales_orders_created_by_fkey(id, full_name),
          assigned_procurement_profile:profiles!sales_orders_assigned_procurement_fkey(id, full_name),
          preferred_supplier:suppliers!sales_orders_preferred_supplier_id_fkey(id, name)
        `)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...data, net_value: computeNetValue(data as any) } as SalesOrderWithDetails;
    },
    enabled: !!id,
  });
}

export function useSalesOrderByLead(leadId: string | undefined) {
  return useQuery({
    queryKey: ['sales-order-by-lead', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('sales_orders')
        .select(`
          *,
          lead:leads(id, title),
          quotation:quotations!sales_orders_quotation_id_fkey(id, quotation_number, grand_total, subtotal, total_discount),
          customer:customers(id, company_name, contact_person, phone, email),
          creator:profiles!sales_orders_created_by_fkey(id, full_name),
          assigned_procurement_profile:profiles!sales_orders_assigned_procurement_fkey(id, full_name),
          preferred_supplier:suppliers!sales_orders_preferred_supplier_id_fkey(id, name)
        `)
        .eq('lead_id', leadId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...data, net_value: computeNetValue(data as any) } as SalesOrderWithDetails;
    },
    enabled: !!leadId,
  });
}

export function useOrderDocuments(salesOrderId: string | undefined) {
  return useQuery({
    queryKey: ['order-documents', salesOrderId],
    queryFn: async () => {
      if (!salesOrderId) return [];
      const { data, error } = await supabase
        .from('order_documents')
        .select('*')
        .eq('sales_order_id', salesOrderId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as OrderDocument[];
    },
    enabled: !!salesOrderId,
  });
}

export function useCreateSalesOrder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      lead_id: string;
      quotation_id?: string;
      customer_id?: string;
      order_value?: number;
      payment_amount?: number;
      payment_status?: 'pending' | 'partial' | 'received';
      notes?: string;
    }) => {
      await ensureFreshSession();
      const tenantId = await requireTenantId();
      
      const insertPayload = {
        lead_id: data.lead_id,
        quotation_id: data.quotation_id,
        customer_id: data.customer_id,
        order_value: data.order_value,
        payment_amount: data.payment_amount,
        payment_status: data.payment_status,
        notes: data.notes,
        created_by: user?.id,
        status: 'pending_documents',
        tenant_id: tenantId,
      } as any;

      // First attempt
      let result = await supabase
        .from('sales_orders')
        .insert(insertPayload)
        .select()
        .single();

      // Auto-retry once on duplicate order_number (race condition safeguard)
      if (result.error?.code === '23505' && result.error?.message?.includes('sales_orders_order_number_key')) {
        console.warn('Order number collision detected, retrying...');
        result = await supabase
          .from('sales_orders')
          .insert(insertPayload)
          .select()
          .single();
      }

      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Sales order created');
      logActivity({
        action: 'create',
        entityType: 'order',
        entityId: data.id,
        entityName: data.order_number,
      });
    },
    onError: (error) => {
      console.error('Error creating sales order:', error);
      toast.error('Failed to create sales order');
    },
  });
}

export function useUpdateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<SalesOrder> & { id: string }) => {
      await ensureFreshSession();
      const { data: order, error } = await supabase
        .from('sales_orders')
        .update(data as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return order;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['sales-order-by-lead'] });
      toast.success('Sales order updated');
      logActivity({
        action: 'update',
        entityType: 'order',
        entityId: data.id,
        entityName: data.order_number,
      });
    },
    onError: (error) => {
      console.error('Error updating sales order:', error);
      toast.error('Failed to update sales order');
    },
  });
}

export function useUploadOrderDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      salesOrderId,
      documentType,
      file,
      customName,
    }: {
      salesOrderId: string;
      documentType: 'customer_po' | 'payment_receipt' | 'tax_invoice' | 'eway_bill' | 'awb' | 'product_image' | 'other';
      file: File;
      customName?: string;
    }) => {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${salesOrderId}/${documentType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('order-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('order-documents')
        .getPublicUrl(fileName);

      // Create document record
      const { data, error } = await supabase
        .from('order_documents')
        .insert({
          sales_order_id: salesOrderId,
          document_type: documentType,
          file_name: file.name,
          file_url: urlData.publicUrl,
          uploaded_by: user?.id,
          notes: customName || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order-documents', data.sales_order_id] });
      toast.success('Document uploaded');
    },
    onError: (error) => {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    },
  });
}

export function useDeleteSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_sales_order_cascade', {
        p_order_id: id
      });
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['customer-payments'] });
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Sales order deleted');
      logActivity({
        action: 'delete',
        entityType: 'order',
        entityId: id,
      });
    },
    onError: (error) => {
      console.error('Error deleting sales order:', error);
      toast.error('Failed to delete sales order');
    },
  });
}

export function useNotifyProcurement() {
  return useMutation({
    mutationFn: async ({
      salesOrderId,
      orderNumber,
      customerName,
      orderValue,
    }: {
      salesOrderId: string;
      orderNumber: string;
      customerName: string;
      orderValue: number;
    }) => {
      // Get procurement users scoped to tenant
      const { data: procurementUsers, error: usersError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['procurement', 'manager', 'coo', 'super_admin']);

      if (usersError) {
        console.error('Failed to fetch procurement users:', usersError);
        return { notified: 0 };
      }

      if (!procurementUsers || procurementUsers.length === 0) {
        console.warn('No procurement users found to notify');
        return { notified: 0 };
      }

      // Dedupe user IDs
      const uniqueUserIds = [...new Set(procurementUsers.map((u) => u.user_id))];

      const notifications = uniqueUserIds.map((userId) => ({
        user_id: userId,
        title: 'New Order Ready for Procurement',
        message: `Order ${orderNumber} from ${customerName} (₹${orderValue.toLocaleString()}) is ready for procurement.`,
        type: 'sales_order',
        link: `/procurement?tab=pending`,
        metadata: { sales_order_id: salesOrderId },
      }));

      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) {
        console.error('Failed to insert notifications:', error);
        return { notified: 0 };
      }

      return { notified: notifications.length };
    },
    onSuccess: (data) => {
      if (data.notified > 0) {
        toast.success(`Notified ${data.notified} procurement team members`);
      }
    },
    onError: (error) => {
      console.error('Error notifying procurement:', error);
    },
  });
}

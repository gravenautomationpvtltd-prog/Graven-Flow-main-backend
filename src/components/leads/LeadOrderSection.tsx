import { useState, useEffect } from 'react';
import { ExternalLink, FileText, Receipt, Package, ChevronDown, ChevronUp, Truck, ClipboardCheck, ShoppingBag, RefreshCw, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSalesOrderByLead, useOrderDocuments } from '@/hooks/useSalesOrders';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { downloadFile } from '@/lib/download-utils';

interface LeadOrderSectionProps {
  leadId: string;
}

interface LinkedPO {
  id: string;
  po_number: string;
  status: string;
  grand_total: number | null;
  supplierName: string | null;
}

interface LinkedGRN {
  id: string;
  grn_number: string;
  status: string;
  received_date: string;
}

interface LinkedDispatch {
  id: string;
  dispatch_number: string;
  status: string;
  courier_name: string | null;
  tracking_number: string | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending_documents: { label: 'Pending Documents', color: 'bg-yellow-500' },
  ready_for_procurement: { label: 'Ready for Procurement', color: 'bg-blue-500' },
  in_procurement: { label: 'In Procurement', color: 'bg-purple-500' },
  partially_fulfilled: { label: 'Partially Fulfilled', color: 'bg-orange-500' },
  fulfilled: { label: 'Fulfilled', color: 'bg-green-500' },
};

const paymentStatusConfig: Record<string, { label: string; variant: 'destructive' | 'secondary' | 'default' }> = {
  pending: { label: 'Payment Pending', variant: 'destructive' },
  partial: { label: 'Partial Payment', variant: 'secondary' },
  received: { label: 'Payment Received', variant: 'default' },
};

const poStatusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  pending_verification: 'bg-yellow-500',
  verified: 'bg-blue-500',
  pending_authorization: 'bg-orange-500',
  authorized: 'bg-indigo-500',
  pending_approval: 'bg-purple-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  sent_to_supplier: 'bg-teal-500',
  delivered: 'bg-emerald-500',
  partial: 'bg-amber-500',
};

const grnStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  verified: 'bg-green-500',
  rejected: 'bg-red-500',
};

const dispatchStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  packed: 'bg-blue-500',
  shipped: 'bg-purple-500',
  in_transit: 'bg-indigo-500',
  delivered: 'bg-green-500',
};

async function fetchLinkedPOs(salesOrderId: string): Promise<LinkedPO[]> {
  const { data, error } = await (supabase as any)
    .from('purchase_orders')
    .select('id, po_number, status, grand_total, supplier_id')
    .eq('sales_order_id', salesOrderId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  if (!data?.length) return [];
  
  const supplierIds = data.map((po: any) => po.supplier_id).filter(Boolean) as string[];
  let suppliersMap: Record<string, string> = {};
  
  if (supplierIds.length > 0) {
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name')
      .in('id', supplierIds);
    suppliersMap = (suppliers || []).reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>);
  }
  
  return data.map((po: any) => ({
    id: po.id,
    po_number: po.po_number,
    status: po.status,
    grand_total: po.grand_total,
    supplierName: po.supplier_id ? suppliersMap[po.supplier_id] || null : null,
  }));
}

async function fetchLinkedGRNs(poIds: string[]): Promise<LinkedGRN[]> {
  if (!poIds.length) return [];
  
  const { data, error } = await (supabase
    .from('goods_receipt_notes')
    .select('id, grn_number, status, received_date')
    .in('po_id', poIds)
    .order('received_date', { ascending: false }) as any);
  
  if (error) throw error;
  return (data || []).map((grn: any) => ({
    id: grn.id,
    grn_number: grn.grn_number,
    status: grn.status,
    received_date: grn.received_date,
  }));
}

async function fetchLinkedDispatches(salesOrderId: string): Promise<LinkedDispatch[]> {
  const { data, error } = await (supabase as any)
    .from('dispatches')
    .select('id, dispatch_number, status, courier_name, tracking_number')
    .eq('sales_order_id', salesOrderId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map((d: any) => ({
    id: d.id,
    dispatch_number: d.dispatch_number,
    status: d.status,
    courier_name: d.courier_name,
    tracking_number: d.tracking_number,
  }));
}

export function LeadOrderSection({ leadId }: LeadOrderSectionProps) {
  const [isProcurementOpen, setIsProcurementOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: order, isLoading, refetch: refetchOrder } = useSalesOrderByLead(leadId);
  const { data: documents = [] } = useOrderDocuments(order?.id);

  const { data: linkedPOs = [], refetch: refetchPOs } = useQuery<LinkedPO[]>({
    queryKey: ['linked-pos', order?.id],
    queryFn: () => fetchLinkedPOs(order!.id),
    enabled: !!order?.id,
  });

  const { data: linkedGRNs = [], refetch: refetchGRNs } = useQuery<LinkedGRN[]>({
    queryKey: ['linked-grns', linkedPOs.map(po => po.id)],
    queryFn: () => fetchLinkedGRNs(linkedPOs.map(po => po.id)),
    enabled: linkedPOs.length > 0,
  });

  const { data: linkedDispatches = [], refetch: refetchDispatches } = useQuery<LinkedDispatch[]>({
    queryKey: ['linked-dispatches', order?.id],
    queryFn: () => fetchLinkedDispatches(order!.id),
    enabled: !!order?.id,
  });

  // Real-time subscriptions for live updates
  useEffect(() => {
    if (!order?.id) return;

    // Subscribe to purchase_orders changes
    const poChannel = supabase
      .channel(`po-changes-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchase_orders',
        },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          // Only refetch if the change is related to this sales order
          if (newRecord?.sales_order_id === order.id || oldRecord?.sales_order_id === order.id) {
            refetchPOs();
            refetchOrder();
          }
        }
      )
      .subscribe();

    // Subscribe to goods_receipt_notes changes
    const grnChannel = supabase
      .channel(`grn-changes-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goods_receipt_notes',
        },
        () => {
          // Refetch GRNs and order (status might have changed)
          refetchGRNs();
          refetchOrder();
        }
      )
      .subscribe();

    // Subscribe to dispatches changes
    const dispatchChannel = supabase
      .channel(`dispatch-changes-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dispatches',
        },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          // Only refetch if the change is related to this sales order
          if (newRecord?.sales_order_id === order.id || oldRecord?.sales_order_id === order.id) {
            refetchDispatches();
            refetchOrder();
          }
        }
      )
      .subscribe();

    // Subscribe to sales_orders changes for this order
    const salesOrderChannel = supabase
      .channel(`sales-order-changes-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sales_orders',
          filter: `id=eq.${order.id}`,
        },
        () => {
          refetchOrder();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(poChannel);
      supabase.removeChannel(grnChannel);
      supabase.removeChannel(dispatchChannel);
      supabase.removeChannel(salesOrderChannel);
    };
  }, [order?.id, refetchPOs, refetchGRNs, refetchDispatches, refetchOrder]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!order) {
    return null;
  }

  const status = statusConfig[order.status] || { label: order.status, color: 'bg-gray-500' };
  const paymentStatus = paymentStatusConfig[order.payment_status] || { label: order.payment_status, variant: 'secondary' as const };
  const customerPO = documents.find((d) => d.document_type === 'customer_po');
  const paymentReceipt = documents.find((d) => d.document_type === 'payment_receipt');

  const hasProcurementData = linkedPOs.length > 0 || linkedGRNs.length > 0 || linkedDispatches.length > 0;

  // Determine next expected action for the user
  const getNextAction = () => {
    if (order.status === 'ready_for_procurement' && linkedPOs.length === 0) {
      return 'Awaiting procurement to create Purchase Order';
    }
    if (linkedPOs.length > 0 && linkedPOs.every(po => po.status === 'draft')) {
      return 'PO created, awaiting approval';
    }
    if (linkedPOs.some(po => ['approved', 'sent_to_supplier'].includes(po.status)) && linkedGRNs.length === 0) {
      return 'Awaiting goods receipt';
    }
    if (linkedGRNs.some(grn => grn.status === 'verified') && linkedDispatches.length === 0) {
      return 'Goods received, awaiting dispatch';
    }
    if (linkedDispatches.some(d => ['pending', 'packed'].includes(d.status))) {
      return 'Dispatch created, awaiting shipment';
    }
    if (linkedDispatches.some(d => ['shipped', 'in_transit'].includes(d.status))) {
      return 'Order shipped, in transit';
    }
    if (order.status === 'fulfilled') {
      return 'Order completed';
    }
    return null;
  };

  const nextAction = getNextAction();

  return (
    <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-5 w-5 text-green-600" />
            Order {order.order_number}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`${status.color} text-white`}>{status.label}</Badge>
            <Badge variant={paymentStatus.variant}>{paymentStatus.label}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Order Value</p>
            <p className="font-semibold text-lg">₹{order.order_value?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Payment Received</p>
            <p className="font-semibold text-lg">₹{order.payment_amount?.toLocaleString()}</p>
          </div>
        </div>

        {/* Next Action Indicator */}
        {nextAction && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
            <RefreshCw className="h-4 w-4 text-blue-600 animate-spin-slow" />
            <span className="text-sm text-blue-700 dark:text-blue-400">
              {nextAction}
            </span>
          </div>
        )}

        {/* Documents */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Documents</p>
          <div className="flex flex-wrap gap-2">
            {customerPO && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => downloadFile(customerPO.file_url, customerPO.file_name)}
              >
                <FileText className="h-4 w-4 text-blue-600" />
                Customer PO
                <Download className="h-3 w-3" />
              </Button>
            )}
            {paymentReceipt && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => downloadFile(paymentReceipt.file_url, paymentReceipt.file_name)}
              >
                <Receipt className="h-4 w-4 text-green-600" />
                Payment Receipt
                <Download className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Quotation Link */}
        {order.quotation && (
          <div className="text-sm">
            <p className="text-muted-foreground">Linked Quotation</p>
            <p className="font-medium">{order.quotation.quotation_number}</p>
          </div>
        )}

        {/* Procurement Progress Section */}
        {hasProcurementData && (
          <Collapsible open={isProcurementOpen} onOpenChange={setIsProcurementOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <ShoppingBag className="h-4 w-4 text-purple-600" />
                  Procurement Progress
                  <Badge variant="secondary" className="ml-2">
                    {linkedPOs.length} PO{linkedPOs.length !== 1 ? 's' : ''} · {linkedGRNs.length} GRN{linkedGRNs.length !== 1 ? 's' : ''} · {linkedDispatches.length} Dispatch{linkedDispatches.length !== 1 ? 'es' : ''}
                  </Badge>
                </span>
                {isProcurementOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Purchase Orders */}
              {linkedPOs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Purchase Orders
                  </p>
                  <div className="space-y-1">
                    {linkedPOs.map((po) => (
                      <div key={po.id} className="flex items-center justify-between p-2 bg-background rounded border text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{po.po_number}</span>
                          <span className="text-muted-foreground">→ {po.supplierName || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">₹{po.grand_total?.toLocaleString()}</span>
                          <Badge className={`${poStatusColors[po.status] || 'bg-gray-500'} text-white text-xs`}>
                            {po.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* GRNs */}
              {linkedGRNs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <ClipboardCheck className="h-3 w-3" /> Goods Receipt Notes
                  </p>
                  <div className="space-y-1">
                    {linkedGRNs.map((grn) => (
                      <div key={grn.id} className="flex items-center justify-between p-2 bg-background rounded border text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{grn.grn_number}</span>
                          <span className="text-muted-foreground">
                            {grn.received_date && format(new Date(grn.received_date), 'dd MMM yyyy')}
                          </span>
                        </div>
                        <Badge className={`${grnStatusColors[grn.status] || 'bg-gray-500'} text-white text-xs`}>
                          {grn.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dispatches */}
              {linkedDispatches.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Truck className="h-3 w-3" /> Dispatches
                  </p>
                  <div className="space-y-1">
                    {linkedDispatches.map((dispatch) => (
                      <div key={dispatch.id} className="flex items-center justify-between p-2 bg-background rounded border text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{dispatch.dispatch_number}</span>
                          {dispatch.courier_name && (
                            <span className="text-muted-foreground">via {dispatch.courier_name}</span>
                          )}
                          {dispatch.tracking_number && (
                            <span className="text-xs text-muted-foreground">#{dispatch.tracking_number}</span>
                          )}
                        </div>
                        <Badge className={`${dispatchStatusColors[dispatch.status] || 'bg-gray-500'} text-white text-xs`}>
                          {dispatch.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* No Procurement Progress Yet */}
        {!hasProcurementData && order.status === 'ready_for_procurement' && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
            <ShoppingBag className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-700 dark:text-blue-400">
              Awaiting procurement team to create Purchase Orders
            </span>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="text-sm">
            <p className="text-muted-foreground">Notes</p>
            <p className="text-foreground">{order.notes}</p>
          </div>
        )}

        {/* Created Info */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Created on {format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}
          {order.creator && ` by ${order.creator.full_name}`}
        </div>
      </CardContent>
    </Card>
  );
}
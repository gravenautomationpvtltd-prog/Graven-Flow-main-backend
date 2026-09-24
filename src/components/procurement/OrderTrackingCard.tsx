import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, FileText, Receipt, Package, Truck, CheckCircle, Plus, ClipboardList, Eye, Download, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { SalesOrderWithDetails, useOrderDocuments } from '@/hooks/useSalesOrders';
import { OrderStatusTimeline } from './OrderStatusTimeline';
import { RecordGRNDialog } from './RecordGRNDialog';
import { CreateDispatchDialog } from '@/components/dispatch/CreateDispatchDialog';
import { UpdateOrderStatusDialog } from '@/components/orders/UpdateOrderStatusDialog';
import { format } from 'date-fns';
import { downloadFile } from '@/lib/download-utils';

interface LinkedPO {
  id: string;
  po_number: string;
  status: string;
  grand_total: number;
  supplier: { name: string } | null;
  created_at: string;
}

interface LinkedGRN {
  id: string;
  grn_number: string;
  status: string;
  received_date: string;
  po: { po_number: string } | null;
  po_id: string;
}

interface LinkedDispatch {
  id: string;
  dispatch_number: string;
  status: string;
  dispatch_date: string | null;
  courier_name: string | null;
  tracking_number: string | null;
}

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

export function OrderTrackingCard({ order }: { order: SalesOrderWithDetails }) {
  const navigate = useNavigate();
  const [linkedPOs, setLinkedPOs] = useState<LinkedPO[]>([]);
  const [linkedGRNs, setLinkedGRNs] = useState<LinkedGRN[]>([]);
  const [linkedDispatches, setLinkedDispatches] = useState<LinkedDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [grnDialogOpen, setGrnDialogOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const { data: documents = [] } = useOrderDocuments(order.id);

  useEffect(() => {
    async function fetchLinkedData() {
      setLoading(true);
      try {
        // Fetch linked POs using filter
        const { data: pos, error: posError } = await supabase
          .from('purchase_orders')
          .select('id, po_number, status, grand_total, created_at, supplier_id')
          .filter('sales_order_id', 'eq', order.id)
          .order('created_at', { ascending: false });

        if (posError) throw posError;
        
        // Fetch supplier names
        const supplierIds = (pos || []).map((po: any) => po.supplier_id).filter(Boolean);
        let suppliersMap: Record<string, string> = {};
        if (supplierIds.length > 0) {
          const { data: suppliers } = await supabase
            .from('suppliers')
            .select('id, name')
            .in('id', supplierIds);
          suppliersMap = (suppliers || []).reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>);
        }
        
        // Map to LinkedPO format
        const linkedPOsData: LinkedPO[] = (pos || []).map((po: any) => ({
          id: po.id,
          po_number: po.po_number,
          status: po.status,
          grand_total: po.grand_total || 0,
          created_at: po.created_at,
          supplier: po.supplier_id ? { name: suppliersMap[po.supplier_id] || 'Unknown' } : null,
        }));
        
        setLinkedPOs(linkedPOsData);

        // Fetch GRNs for linked POs
        if (linkedPOsData && linkedPOsData.length > 0) {
          const poIds = linkedPOsData.map((po) => po.id);
          const { data: grns } = await supabase
            .from('goods_receipt_notes')
            .select('id, grn_number, status, received_date, po_id')
            .in('po_id', poIds)
            .order('received_date', { ascending: false });

          const linkedGRNsData: LinkedGRN[] = (grns || []).map(grn => {
            const po = linkedPOsData.find(p => p.id === grn.po_id);
            return {
              id: grn.id,
              grn_number: grn.grn_number,
              status: grn.status,
              received_date: grn.received_date,
              po: po ? { po_number: po.po_number } : null,
              po_id: grn.po_id,
            };
          });
          setLinkedGRNs(linkedGRNsData);
        }

        // Fetch dispatches for this order
        const { data: dispatches } = await supabase
          .from('dispatches')
          .select('id, dispatch_number, status, dispatch_date, courier_name, tracking_number')
          .filter('sales_order_id', 'eq', order.id)
          .order('created_at', { ascending: false });

        const linkedDispatchesData: LinkedDispatch[] = (dispatches || []).map(d => ({
          id: d.id,
          dispatch_number: d.dispatch_number,
          status: d.status,
          dispatch_date: d.dispatch_date,
          courier_name: d.courier_name,
          tracking_number: d.tracking_number,
        }));
        setLinkedDispatches(linkedDispatchesData);
      } catch (error) {
        console.error('Error fetching linked data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLinkedData();
  }, [order.id]);

  const customerPO = documents.find((d) => d.document_type === 'customer_po');
  const paymentReceipt = documents.find((d) => d.document_type === 'payment_receipt');

  // Determine next actions based on current state
  const approvedPOs = linkedPOs.filter(po => ['approved', 'sent_to_supplier', 'partial'].includes(po.status));
  const canRecordGRN = approvedPOs.length > 0;
  const hasVerifiedGRNs = linkedGRNs.some(grn => grn.status === 'verified');
  const canCreateDispatch = hasVerifiedGRNs && order.status !== 'fulfilled';

  const handleCreatePO = () => {
    navigate(`/procurement?createPO=true&salesOrderId=${order.id}`);
  };

  const handleRecordGRN = (poId: string) => {
    setSelectedPoId(poId);
    setGrnDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Order Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer Info */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Customer</p>
          <p className="font-medium">{order.customer?.company_name}</p>
          <p className="text-sm text-muted-foreground">{order.customer?.contact_person}</p>
          {order.customer?.phone && (
            <p className="text-sm">{order.customer.phone}</p>
          )}
        </div>

        {/* Order Value */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Order Value</p>
          <p className="text-xl font-bold">₹{order.order_value?.toLocaleString()}</p>
          <Badge
            variant={order.payment_status === 'received' ? 'default' : 'secondary'}
            className={
              order.payment_status === 'received'
                ? 'bg-green-500'
                : order.payment_status === 'partial'
                ? 'bg-amber-500'
                : 'bg-red-500'
            }
          >
            {order.payment_status === 'received'
              ? 'Paid'
              : order.payment_status === 'partial'
              ? `Partial: ₹${order.payment_amount?.toLocaleString()}`
              : 'Payment Pending'}
          </Badge>
        </div>

        {/* Documents */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Documents</p>
          <div className="flex flex-wrap gap-2">
            {customerPO && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1"
                onClick={() => downloadFile(customerPO.file_url, customerPO.file_name)}
              >
                <FileText className="h-3 w-3" />
                Customer PO
                <Download className="h-3 w-3" />
              </Button>
            )}
            {paymentReceipt && (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1"
                onClick={() => downloadFile(paymentReceipt.file_url, paymentReceipt.file_name)}
              >
                <Receipt className="h-3 w-3" />
                Receipt
                <Download className="h-3 w-3" />
              </Button>
            )}
            {order.quotation && (
              <Button variant="outline" size="sm" asChild className="gap-1">
                <Link to={`/leads/${order.lead_id}?tab=quotations`}>
                  <FileText className="h-3 w-3" />
                  {order.quotation.quotation_number}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg border">
        <Button size="sm" onClick={handleCreatePO} className="gap-1">
          <Plus className="h-4 w-4" />
          Create PO
        </Button>
        
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => setStatusDialogOpen(true)}
          className="gap-1"
        >
          <ArrowUpCircle className="h-4 w-4" />
          Update Status
        </Button>
        
        {canRecordGRN && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => handleRecordGRN(approvedPOs[0].id)}
            className="gap-1"
          >
            <ClipboardList className="h-4 w-4" />
            Record GRN
          </Button>
        )}
        
        {canCreateDispatch && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setDispatchDialogOpen(true)}
            className="gap-1"
          >
            <Truck className="h-4 w-4" />
            Create Dispatch
          </Button>
        )}
      </div>

      {/* Status Timeline */}
      <OrderStatusTimeline
        order={order}
        linkedPOs={linkedPOs}
        linkedGRNs={linkedGRNs}
        linkedDispatches={linkedDispatches}
      />

      {/* Linked Purchase Orders */}
      {linkedPOs.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Purchase Orders ({linkedPOs.length})
          </h4>
          <div className="grid gap-2">
            {linkedPOs.map((po) => (
              <div
                key={po.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-medium">{po.po_number}</span>
                    <span className="text-muted-foreground mx-2">•</span>
                    <span className="text-sm text-muted-foreground">
                      {po.supplier?.name || 'No Supplier'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">₹{po.grand_total?.toLocaleString()}</span>
                  <Badge className={`${poStatusColors[po.status] || 'bg-gray-500'} text-white`}>
                    {po.status.replace(/_/g, ' ')}
                  </Badge>
                  {['approved', 'sent_to_supplier', 'partial'].includes(po.status) && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleRecordGRN(po.id)}
                      className="gap-1"
                    >
                      <ClipboardList className="h-3 w-3" />
                      GRN
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/procurement?po=${po.id}`}>
                      <Eye className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked GRNs */}
      {linkedGRNs.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Goods Received ({linkedGRNs.length})
          </h4>
          <div className="grid gap-2">
            {linkedGRNs.map((grn) => (
              <div
                key={grn.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div>
                  <span className="font-medium">{grn.grn_number}</span>
                  <span className="text-muted-foreground mx-2">•</span>
                  <span className="text-sm text-muted-foreground">
                    {grn.po?.po_number || 'Unknown PO'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    {format(new Date(grn.received_date), 'dd MMM yyyy')}
                  </span>
                  <Badge variant="outline">{grn.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked Dispatches */}
      {linkedDispatches.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Dispatches ({linkedDispatches.length})
          </h4>
          <div className="grid gap-2">
            {linkedDispatches.map((dispatch) => (
              <div
                key={dispatch.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div>
                  <span className="font-medium">{dispatch.dispatch_number}</span>
                  {dispatch.courier_name && (
                    <>
                      <span className="text-muted-foreground mx-2">•</span>
                      <span className="text-sm text-muted-foreground">
                        {dispatch.courier_name}
                      </span>
                    </>
                  )}
                  {dispatch.tracking_number && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({dispatch.tracking_number})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {dispatch.dispatch_date && (
                    <span className="text-sm">
                      {format(new Date(dispatch.dispatch_date), 'dd MMM yyyy')}
                    </span>
                  )}
                  <Badge variant="outline">{dispatch.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State for No Linked Items */}
      {linkedPOs.length === 0 && linkedGRNs.length === 0 && linkedDispatches.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No procurement activity yet</p>
          <p className="text-xs mt-1">Click "Create PO" to start procurement</p>
        </div>
      )}

      {/* Record GRN Dialog */}
      {selectedPoId && (
        <RecordGRNDialog
          open={grnDialogOpen}
          onOpenChange={setGrnDialogOpen}
          poId={selectedPoId}
        />
      )}

      {/* Create Dispatch Dialog */}
      <CreateDispatchDialog
        open={dispatchDialogOpen}
        onOpenChange={setDispatchDialogOpen}
        defaultCustomerId={order.customer_id}
        defaultLeadId={order.lead_id}
        salesOrderId={order.id}
      />

      {/* Update Order Status Dialog */}
      <UpdateOrderStatusDialog
        orderId={order.id}
        orderNumber={order.order_number}
        currentStatus={order.status}
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
      />
    </div>
  );
}
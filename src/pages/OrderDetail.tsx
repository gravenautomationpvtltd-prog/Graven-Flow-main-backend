import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Package, 
  FileText, 
  Receipt, 
  Plus, 
  ClipboardList, 
  Truck, 
  ArrowUpCircle,
  Building2,
  Calendar,
  CreditCard,
  ExternalLink,
  Download,
  CheckCircle,
  Eye,
  ArrowLeft,
  Plane,
  MapPin,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useSalesOrder, useOrderDocuments, SalesOrderWithDetails } from '@/hooks/useSalesOrders';
import { OrderStatusTimeline } from '@/components/procurement/OrderStatusTimeline';
import { RecordGRNDialog } from '@/components/procurement/RecordGRNDialog';
import { CreateDispatchDialog } from '@/components/dispatch/CreateDispatchDialog';
import { UpdateOrderStatusDialog } from '@/components/orders/UpdateOrderStatusDialog';
import { GenerateEInvoiceDialog } from '@/components/orders/GenerateEInvoiceDialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { downloadFile } from '@/lib/download-utils';

interface LinkedPO {
  id: string;
  po_number: string;
  status: string;
  grand_total: number;
  supplier: { name: string } | null;
  expected_delivery: string | null;
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

const statusColors: Record<string, string> = {
  pending_documents: 'bg-gray-500',
  ready_for_procurement: 'bg-amber-500',
  in_procurement: 'bg-blue-500',
  partially_fulfilled: 'bg-purple-500',
  ready_to_dispatch: 'bg-cyan-500',
  fulfilled: 'bg-green-500',
};

const statusLabels: Record<string, string> = {
  pending_documents: 'Pending Documents',
  ready_for_procurement: 'Ready for Procurement',
  in_procurement: 'In Procurement',
  partially_fulfilled: 'Partially Fulfilled',
  ready_to_dispatch: 'Ready to Dispatch',
  fulfilled: 'Fulfilled',
};

const paymentColors: Record<string, string> = {
  pending: 'bg-red-500',
  partial: 'bg-amber-500',
  received: 'bg-green-500',
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

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading } = useSalesOrder(id);
  const { data: documents = [] } = useOrderDocuments(id);

  const [linkedPOs, setLinkedPOs] = useState<LinkedPO[]>([]);
  const [linkedGRNs, setLinkedGRNs] = useState<LinkedGRN[]>([]);
  const [linkedDispatches, setLinkedDispatches] = useState<LinkedDispatch[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(true);

  const [grnDialogOpen, setGrnDialogOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [einvoiceDialogOpen, setEinvoiceDialogOpen] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchLinkedData() {
      setLoadingLinked(true);
      try {
        // Fetch linked POs
        const { data: pos, error: posError } = await supabase
          .from('purchase_orders')
          .select('id, po_number, status, grand_total, created_at, supplier_id, expected_delivery')
          .filter('sales_order_id', 'eq', id)
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

        const linkedPOsData: LinkedPO[] = (pos || []).map((po: any) => ({
          id: po.id,
          po_number: po.po_number,
          status: po.status,
          grand_total: po.grand_total || 0,
          created_at: po.created_at,
          expected_delivery: po.expected_delivery,
          supplier: po.supplier_id ? { name: suppliersMap[po.supplier_id] || 'Unknown' } : null,
        }));

        setLinkedPOs(linkedPOsData);

        // Fetch GRNs for linked POs
        if (linkedPOsData.length > 0) {
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

        // Fetch dispatches
        const { data: dispatches } = await supabase
          .from('dispatches')
          .select('id, dispatch_number, status, dispatch_date, courier_name, tracking_number')
          .filter('sales_order_id', 'eq', id)
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
        setLoadingLinked(false);
      }
    }

    fetchLinkedData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
        <p className="text-muted-foreground mb-4">The order you're looking for doesn't exist.</p>
        <Button onClick={() => navigate('/procurement')}>
          Back to Procurement
        </Button>
      </div>
    );
  }

  const customerPO = documents.find((d) => d.document_type === 'customer_po');
  const paymentReceipt = documents.find((d) => d.document_type === 'payment_receipt');
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

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/procurement?tab=sales-orders')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Orders
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{order.order_number}</h1>
            <Badge className={`${statusColors[order.status] || 'bg-gray-500'} text-white`}>
              {statusLabels[order.status] || order.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">{order.customer?.company_name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setStatusDialogOpen(true)}>
            <ArrowUpCircle className="h-4 w-4 mr-2" />
            Update Status
          </Button>
          <Button size="sm" onClick={handleCreatePO}>
            <Plus className="h-4 w-4 mr-2" />
            Create PO
          </Button>
          {canRecordGRN && (
            <Button variant="outline" size="sm" onClick={() => handleRecordGRN(approvedPOs[0].id)}>
              <ClipboardList className="h-4 w-4 mr-2" />
              Record GRN
            </Button>
          )}
          {canCreateDispatch && (
            <Button variant="outline" size="sm" onClick={() => setDispatchDialogOpen(true)}>
              <Truck className="h-4 w-4 mr-2" />
              Create Dispatch
            </Button>
          )}
          {order.status === 'ready_to_dispatch' && (
            <Button variant="outline" size="sm" onClick={() => setEinvoiceDialogOpen(true)}>
              <FileText className="h-4 w-4 mr-2" />
              E-Invoice & E-Way Bill
            </Button>
          )}
        </div>
      </div>

      {/* Procurement Tracking Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {(order as any).is_import ? (
              <>
                <Plane className="h-5 w-5 text-blue-500" />
                Import Order
              </>
            ) : (
              <>
                <MapPin className="h-5 w-5" />
                Local Order
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Procurement Person */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Handled By</p>
                <p className="font-medium">
                  {order.assigned_procurement_profile?.full_name || 'Unassigned'}
                </p>
              </div>
            </div>

            {/* Supplier */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Supplier</p>
                <p className="font-medium">
                  {linkedPOs.length > 0 
                    ? linkedPOs.length > 1 
                      ? `${linkedPOs[0].supplier?.name || 'Unknown'} +${linkedPOs.length - 1} more`
                      : linkedPOs[0].supplier?.name || 'Unknown'
                    : (order as any).preferred_supplier?.name 
                      ? <span className="text-muted-foreground italic">{(order as any).preferred_supplier.name}</span>
                      : 'No PO created'}
                </p>
              </div>
            </div>

            {/* Expected Arrival */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Expected Arrival</p>
                <p className="font-medium">
                  {(() => {
                    const deliveries = linkedPOs
                      .map(po => po.expected_delivery)
                      .filter(Boolean) as string[];
                    if (deliveries.length > 0) {
                      const earliest = deliveries.sort()[0];
                      return format(new Date(earliest), 'dd MMM yyyy');
                    }
                    if ((order as any).expected_arrival) {
                      return <span className="text-muted-foreground italic">{format(new Date((order as any).expected_arrival), 'dd MMM yyyy')}</span>;
                    }
                    return 'TBD';
                  })()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Order Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLinked ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <OrderStatusTimeline
              order={order}
              linkedPOs={linkedPOs}
              linkedGRNs={linkedGRNs}
              linkedDispatches={linkedDispatches}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Linked Purchase Orders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Purchase Orders ({linkedPOs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLinked ? (
                <Skeleton className="h-20 w-full" />
              ) : linkedPOs.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No purchase orders yet</p>
                  <Button variant="link" size="sm" onClick={handleCreatePO}>
                    Create first PO
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedPOs.map((po) => (
                    <div
                      key={po.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <span className="font-medium">{po.po_number}</span>
                        <span className="text-muted-foreground mx-2">•</span>
                        <span className="text-sm text-muted-foreground">
                          {po.supplier?.name || 'No Supplier'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">₹{po.grand_total?.toLocaleString()}</span>
                        <Badge className={`${poStatusColors[po.status] || 'bg-gray-500'} text-white`}>
                          {po.status.replace(/_/g, ' ')}
                        </Badge>
                        {['approved', 'sent_to_supplier', 'partial'].includes(po.status) && (
                          <Button size="sm" variant="ghost" onClick={() => handleRecordGRN(po.id)}>
                            <ClipboardList className="h-3 w-3" />
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
              )}
            </CardContent>
          </Card>

          {/* Linked GRNs */}
          {linkedGRNs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Goods Received ({linkedGRNs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
              </CardContent>
            </Card>
          )}

          {/* Linked Dispatches */}
          {linkedDispatches.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Dispatches ({linkedDispatches.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">₹{order.order_value?.toLocaleString()}</p>
                  <Badge className={`${paymentColors[order.payment_status]} text-white`}>
                    {order.payment_status === 'received'
                      ? 'Paid'
                      : order.payment_status === 'partial'
                      ? `Partial: ₹${order.payment_amount?.toLocaleString()}`
                      : 'Payment Pending'}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <Link 
                      to={`/customers/${order.customer_id}`} 
                      className="font-medium hover:underline"
                    >
                      {order.customer?.company_name}
                    </Link>
                    {order.customer?.contact_person && (
                      <p className="text-sm text-muted-foreground">{order.customer.contact_person}</p>
                    )}
                  </div>
                </div>

                {order.lead && (
                  <div className="flex items-start gap-3">
                    <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Lead</p>
                      <Link 
                        to={`/leads/${order.lead_id}`} 
                        className="font-medium hover:underline"
                      >
                        {order.lead.title}
                      </Link>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {format(new Date(order.created_at), 'dd MMM yyyy')}
                    </p>
                    {order.creator && (
                      <p className="text-sm text-muted-foreground">by {order.creator.full_name}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {customerPO && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => downloadFile(customerPO.file_url, customerPO.file_name)}
                  >
                    <FileText className="h-4 w-4 text-blue-600" />
                    Customer PO
                    <Download className="h-3 w-3 ml-auto" />
                  </Button>
                )}
                {paymentReceipt && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => downloadFile(paymentReceipt.file_url, paymentReceipt.file_name)}
                  >
                    <Receipt className="h-4 w-4 text-green-600" />
                    Payment Receipt
                    <Download className="h-3 w-3 ml-auto" />
                  </Button>
                )}
                {order.quotation && (
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                    <Link to={`/leads/${order.lead_id}?tab=quotations`}>
                      <FileText className="h-4 w-4" />
                      {order.quotation.quotation_number}
                      <ExternalLink className="h-3 w-3 ml-auto" />
                    </Link>
                  </Button>
                )}
                {!customerPO && !paymentReceipt && !order.quotation && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No documents uploaded
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {selectedPoId && (
        <RecordGRNDialog
          open={grnDialogOpen}
          onOpenChange={setGrnDialogOpen}
          poId={selectedPoId}
        />
      )}

      <CreateDispatchDialog
        open={dispatchDialogOpen}
        onOpenChange={setDispatchDialogOpen}
        defaultCustomerId={order.customer_id}
        defaultLeadId={order.lead_id}
        salesOrderId={order.id}
      />

      <UpdateOrderStatusDialog
        orderId={order.id}
        orderNumber={order.order_number}
        currentStatus={order.status}
        currentIsImport={(order as any).is_import || false}
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
      />

      <GenerateEInvoiceDialog
        open={einvoiceDialogOpen}
        onOpenChange={setEinvoiceDialogOpen}
        orderId={order.id}
        orderNumber={order.order_number}
      />
    </div>
  );
}

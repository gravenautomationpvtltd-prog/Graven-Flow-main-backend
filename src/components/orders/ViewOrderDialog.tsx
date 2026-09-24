import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  ExternalLink, 
  Download, 
  User, 
  Building2, 
  Phone, 
  Mail,
  IndianRupee,
  Calendar,
  Truck,
  Package2,
  Send
} from 'lucide-react';
import { useSalesOrder, useOrderDocuments } from '@/hooks/useSalesOrders';
import { useDispatchDocuments } from '@/hooks/useDispatchDocuments';
import { OrderStatusTimeline } from '@/components/procurement/OrderStatusTimeline';
import { SendDispatchEmailDialog } from '@/components/dispatch/SendDispatchEmailDialog';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { downloadFile, downloadMultipleFiles } from '@/lib/download-utils';

type DispatchDocumentType = Database['public']['Enums']['dispatch_document_type'];

interface ViewOrderDialogProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LinkedPO {
  id: string;
  po_number: string;
  status: string;
  created_at: string;
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
  dispatch_date: string | null;
  courier_name: string | null;
  tracking_number: string | null;
}

const statusColors: Record<string, string> = {
  pending_documents: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  ready_for_procurement: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_procurement: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  partially_fulfilled: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  ready_to_dispatch: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  fulfilled: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
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
  pending: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  received: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const dispatchStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  packed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  in_transit: 'bg-amber-100 text-amber-800',
  delivered: 'bg-green-100 text-green-800',
};

const documentTypeLabels: Record<DispatchDocumentType, string> = {
  invoice: 'Tax Invoice',
  eway_bill: 'E-Way Bill',
  awb: 'AWB / Docket',
  packing_list: 'Packing List',
  other: 'Other Document',
};

export function ViewOrderDialog({ orderId, open, onOpenChange }: ViewOrderDialogProps) {
  const navigate = useNavigate();
  const { isManager, isAdmin, isProcurement } = useAuth();
  const { data: order, isLoading } = useSalesOrder(orderId || undefined);
  const { data: documents } = useOrderDocuments(orderId || undefined);
  
  const [linkedPOs, setLinkedPOs] = useState<LinkedPO[]>([]);
  const [linkedGRNs, setLinkedGRNs] = useState<LinkedGRN[]>([]);
  const [linkedDispatches, setLinkedDispatches] = useState<LinkedDispatch[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedDispatchForEmail, setSelectedDispatchForEmail] = useState<LinkedDispatch | null>(null);

  // Fetch linked POs, GRNs, and Dispatches for timeline
  useEffect(() => {
    if (!orderId || !open) return;

    const fetchLinkedData = async () => {
      // Fetch linked POs
      const { data: posData } = await supabase
        .from('purchase_orders')
        .select('id, po_number, status, created_at')
        .eq('sales_order_id', orderId)
        .order('created_at', { ascending: false });
      
      setLinkedPOs(posData || []);

      // Get PO IDs
      const poIds = posData?.map(po => po.id) || [];

      // Fetch GRNs linked to these POs
      if (poIds.length > 0) {
        const { data: grnsData } = await supabase
          .from('goods_receipt_notes')
          .select('id, grn_number, status, received_date')
          .in('po_id', poIds)
          .order('received_date', { ascending: false });
        
        setLinkedGRNs(grnsData || []);
      } else {
        setLinkedGRNs([]);
      }

      // Fetch dispatches linked to this order
      const { data: dispatchesData } = await supabase
        .from('dispatches')
        .select('id, dispatch_number, status, dispatch_date, courier_name, tracking_number')
        .eq('sales_order_id', orderId)
        .order('dispatch_date', { ascending: false });
      
      setLinkedDispatches(dispatchesData || []);
    };

    fetchLinkedData();
  }, [orderId, open]);

  const handleOpenEmailDialog = (dispatch: LinkedDispatch) => {
    setSelectedDispatchForEmail(dispatch);
    setEmailDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <Skeleton className="h-6 w-48" />
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!order) return null;

  const outstandingAmount = (order.order_value || 0) - (order.payment_amount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{order.order_number}</DialogTitle>
            <div className="flex gap-2">
              <Badge className={statusColors[order.status]}>
                {statusLabels[order.status]}
              </Badge>
              <Badge className={paymentColors[order.payment_status]}>
                {order.payment_status?.charAt(0).toUpperCase() + order.payment_status?.slice(1)}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Value Section */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <IndianRupee className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <div className="text-2xl font-bold">₹{(order.order_value || 0).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Order Value</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <IndianRupee className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <div className="text-2xl font-bold text-green-600">₹{(order.payment_amount || 0).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Received</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <IndianRupee className="h-5 w-5 mx-auto text-amber-500 mb-1" />
              <div className="text-2xl font-bold text-amber-600">₹{outstandingAmount.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Outstanding</div>
            </div>
          </div>

          <Separator />

          {/* Order Status Timeline */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Package2 className="h-4 w-4" />
              Order Timeline
            </h3>
            <div className="rounded-lg border p-4">
              <OrderStatusTimeline
                order={order}
                linkedPOs={linkedPOs}
                linkedGRNs={linkedGRNs}
                linkedDispatches={linkedDispatches}
              />
            </div>
          </div>

          <Separator />

          {/* Customer Info */}
          {order.customer && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Customer Details
              </h3>
              <div className="rounded-lg border p-4 space-y-2">
                <div className="font-medium">{order.customer.company_name}</div>
                {order.customer.contact_person && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    {order.customer.contact_person}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {order.customer.phone}
                </div>
                {order.customer.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {order.customer.email}
                  </div>
                )}
                {(isManager || isAdmin || !isProcurement) && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/customers/${order.customer_id}`);
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Customer
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Order Info */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Order Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Created:</span>
                <span className="ml-2 font-medium">
                  {format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Created By:</span>
                <span className="ml-2 font-medium">{order.creator?.full_name || '-'}</span>
              </div>
              {order.quotation && (
                <div>
                  <span className="text-muted-foreground">Quotation:</span>
                  <span className="ml-2 font-medium">{order.quotation.quotation_number}</span>
                </div>
              )}
              {order.lead && (
                <div>
                  <span className="text-muted-foreground">Lead:</span>
                  <span className="ml-2 font-medium">{order.lead.title}</span>
                </div>
              )}
            </div>
          </div>

          {/* Documents */}
          {documents && documents.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Order Documents ({documents.length})
                </h3>
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{doc.file_name}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {doc.document_type.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => downloadFile(doc.file_url, doc.file_name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Shipping & Dispatch Section */}
          {linkedDispatches.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Shipping & Dispatch ({linkedDispatches.length})
                </h3>
                <div className="space-y-4">
                  {linkedDispatches.map((dispatch) => (
                    <DispatchCard
                      key={dispatch.id}
                      dispatch={dispatch}
                      customerEmail={order.customer?.email || null}
                      customerName={order.customer?.company_name || 'Customer'}
                      onOpenEmailDialog={handleOpenEmailDialog}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {order.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-semibold">Notes</h3>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </div>
            </>
          )}

          {/* Actions */}
          <Separator />
          {(isManager || isAdmin || !isProcurement) && order.lead_id && (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/leads/${order.lead_id}`);
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Lead
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Email Dialog */}
      {selectedDispatchForEmail && (
        <SendDispatchEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          dispatchId={selectedDispatchForEmail.id}
          dispatchNumber={selectedDispatchForEmail.dispatch_number}
          customerEmail={order.customer?.email || null}
          customerName={order.customer?.company_name || 'Customer'}
        />
      )}
    </Dialog>
  );
}

// Dispatch Card Component with documents
interface DispatchCardProps {
  dispatch: LinkedDispatch;
  customerEmail: string | null;
  customerName: string;
  onOpenEmailDialog: (dispatch: LinkedDispatch) => void;
}

function DispatchCard({ dispatch, customerEmail, customerName, onOpenEmailDialog }: DispatchCardProps) {
  const { data: dispatchDocuments } = useDispatchDocuments(dispatch.id);

  const handleDownloadAll = async () => {
    if (!dispatchDocuments?.length) return;
    const files = dispatchDocuments.map(doc => ({ url: doc.file_url, fileName: doc.file_name }));
    await downloadMultipleFiles(files);
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-medium">{dispatch.dispatch_number}</div>
            {dispatch.courier_name && (
              <div className="text-xs text-muted-foreground">
                {dispatch.courier_name} {dispatch.tracking_number && `• ${dispatch.tracking_number}`}
              </div>
            )}
          </div>
        </div>
        <Badge className={dispatchStatusColors[dispatch.status] || 'bg-gray-100'}>
          {dispatch.status.replace('_', ' ').charAt(0).toUpperCase() + dispatch.status.replace('_', ' ').slice(1)}
        </Badge>
      </div>

      {dispatch.dispatch_date && (
        <div className="text-xs text-muted-foreground">
          Dispatched: {format(new Date(dispatch.dispatch_date), 'dd MMM yyyy')}
        </div>
      )}

      {/* Dispatch Documents */}
      {dispatchDocuments && dispatchDocuments.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Documents</div>
          <div className="grid grid-cols-2 gap-2">
            {dispatchDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded border p-2 text-sm"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{documentTypeLabels[doc.document_type]}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => downloadFile(doc.file_url, doc.file_name)}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenEmailDialog(dispatch)}
          disabled={!dispatchDocuments || dispatchDocuments.length === 0}
        >
          <Send className="mr-2 h-4 w-4" />
          Email to Customer
        </Button>
        {dispatchDocuments && dispatchDocuments.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleDownloadAll}>
            <Download className="mr-2 h-4 w-4" />
            Download All
          </Button>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Truck, Mail, Package, Tags } from 'lucide-react';
import { generatePackingListPdf } from '@/lib/packing-list-pdf';
import { useDispatch, useUpdateDispatchStatus } from '@/hooks/useDispatches';
import { generateDispatchPdf } from '@/lib/dispatch-pdf';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DispatchDocumentsSection } from './DispatchDocumentsSection';
import { SendDispatchEmailDialog } from './SendDispatchEmailDialog';
import { ShippingLabelDialog } from './ShippingLabelDialog';

interface ViewDispatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatchId: string | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  packed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  in_transit: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  returned: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  packed: 'Packed',
  shipped: 'Shipped',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  returned: 'Returned',
};

const statusFlow = ['pending', 'packed', 'shipped', 'in_transit', 'delivered'];

export function ViewDispatchDialog({ open, onOpenChange, dispatchId }: ViewDispatchDialogProps) {
  const [newStatus, setNewStatus] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const { data: dispatch, isLoading } = useDispatch(dispatchId ?? undefined);
  const updateStatus = useUpdateDispatchStatus();

  const handleDownloadPdf = () => {
    if (dispatch) {
      generateDispatchPdf(dispatch);
    }
  };

  const handleUpdateStatus = async () => {
    if (dispatch && newStatus) {
      await updateStatus.mutateAsync({ id: dispatch.id, status: newStatus });
      setNewStatus(null);
    }
  };

  if (!dispatchId || isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            Loading...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!dispatch) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="text-center py-8 text-muted-foreground">
            Dispatch not found
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const currentStatusIndex = statusFlow.indexOf(dispatch.status);
  const nextStatuses = statusFlow.slice(currentStatusIndex + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {dispatch.dispatch_number}
            </DialogTitle>
            <Badge className={statusColors[dispatch.status] || 'bg-muted'}>
              {statusLabels[dispatch.status] || dispatch.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Ship To</h4>
              {dispatch.customer ? (
                <div>
                  <div className="font-medium">{dispatch.customer.company_name}</div>
                  {dispatch.customer.contact_person && (
                    <div className="text-sm text-muted-foreground">{dispatch.customer.contact_person}</div>
                  )}
                  {dispatch.shipping_address && (
                    <div className="text-sm text-muted-foreground mt-1">{dispatch.shipping_address}</div>
                  )}
                  {dispatch.customer.phone && (
                    <div className="text-sm text-muted-foreground">{dispatch.customer.phone}</div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground">No customer</div>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Details</h4>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-muted-foreground">Dispatch Date:</span>{' '}
                  {dispatch.dispatch_date ? format(new Date(dispatch.dispatch_date), 'PPP') : '-'}
                </div>
                {dispatch.quotation && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Quotation:</span>{' '}
                    {dispatch.quotation.quotation_number}
                  </div>
                )}
                {dispatch.courier_name && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Courier:</span>{' '}
                    {dispatch.courier_name}
                  </div>
                )}
                {dispatch.tracking_number && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Tracking #:</span>{' '}
                    {dispatch.tracking_number}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <h4 className="text-sm font-medium mb-3">Items</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispatch.items?.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Update Status */}
          {dispatch.status !== 'delivered' && dispatch.status !== 'returned' && nextStatuses.length > 0 && (
            <>
              <Separator />
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Update Status:</span>
                <Select value={newStatus || ''} onValueChange={setNewStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {nextStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleUpdateStatus}
                  disabled={!newStatus || updateStatus.isPending}
                >
                  {updateStatus.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </>
          )}

          {/* Notes */}
          {dispatch.notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{dispatch.notes}</p>
              </div>
            </>
          )}
          <Separator />

          {/* Documents Section */}
          <DispatchDocumentsSection dispatchId={dispatch.id} />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setEmailDialogOpen(true)}>
            <Mail className="mr-2 h-4 w-4" />
            Email to Customer
          </Button>
          <Button variant="outline" onClick={() => dispatch && generatePackingListPdf(dispatch)}>
            <Package className="mr-2 h-4 w-4" />
            Packing List
          </Button>
          <Button variant="outline" onClick={() => setLabelDialogOpen(true)}>
            <Tags className="mr-2 h-4 w-4" />
            Shipping Labels
          </Button>
          <Button onClick={handleDownloadPdf}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>

      <SendDispatchEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        dispatchId={dispatch.id}
        dispatchNumber={dispatch.dispatch_number}
        customerEmail={dispatch.customer?.email || null}
        customerName={dispatch.customer?.company_name || 'Customer'}
      />

      <ShippingLabelDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        dispatch={dispatch}
      />
    </Dialog>
  );
}

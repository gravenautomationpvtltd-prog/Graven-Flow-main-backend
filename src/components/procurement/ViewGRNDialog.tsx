import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useGRN, useVerifyGRN } from '@/hooks/useGRN';
import { useAuth } from '@/hooks/useAuth';

interface ViewGRNDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grnId: string | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  verified: 'bg-green-100 text-green-800',
  posted: 'bg-blue-100 text-blue-800',
};

export function ViewGRNDialog({ open, onOpenChange, grnId }: ViewGRNDialogProps) {
  const { data: grn, isLoading } = useGRN(grnId ?? undefined);
  const verifyGRN = useVerifyGRN();
  const { isAdmin, isManager } = useAuth();

  const canVerify = (isAdmin || isManager) && grn?.status === 'pending';

  const handleVerify = async () => {
    if (grn) {
      await verifyGRN.mutateAsync(grn.id);
      onOpenChange(false);
    }
  };

  if (!grnId || isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!grn) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="text-center py-8 text-muted-foreground">
            Goods receipt not found
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const totalReceived = grn.items?.reduce((sum, item) => sum + item.received_quantity, 0) || 0;
  const totalAccepted = grn.items?.reduce((sum, item) => sum + item.accepted_quantity, 0) || 0;
  const totalRejected = grn.items?.reduce((sum, item) => sum + item.rejected_quantity, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {grn.grn_number}
            </DialogTitle>
            <Badge className={statusColors[grn.status] || 'bg-muted'}>
              {grn.status.charAt(0).toUpperCase() + grn.status.slice(1)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Details</h4>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">PO Number:</span>{' '}
                  <span className="font-medium">{grn.purchase_order?.po_number || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Supplier:</span>{' '}
                  <span className="font-medium">{grn.supplier?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Received Date:</span>{' '}
                  {grn.received_date ? format(new Date(grn.received_date), 'PPP') : '-'}
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Received By</h4>
              <div className="space-y-1 text-sm">
                <div className="font-medium">{grn.receiver?.full_name || '-'}</div>
                <div className="text-muted-foreground">
                  {format(new Date(grn.created_at), 'PPP p')}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Items Table */}
          <div>
            <h4 className="text-sm font-medium mb-3">Items</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Ordered</TableHead>
                    <TableHead className="text-center">Received</TableHead>
                    <TableHead className="text-center">Accepted</TableHead>
                    <TableHead className="text-center">Rejected</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grn.items?.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {item.product?.name || '-'}
                        {item.batch_number && (
                          <div className="text-xs text-muted-foreground">
                            Batch: {item.batch_number}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.ordered_quantity}</TableCell>
                      <TableCell className="text-center">{item.received_quantity}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          {item.accepted_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.rejected_quantity > 0 ? (
                          <Badge variant="destructive">{item.rejected_quantity}</Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.rejection_reason || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Summary */}
          <div className="flex justify-end gap-6 text-sm">
            <div>
              Total Received: <span className="font-bold">{totalReceived}</span>
            </div>
            <div>
              Accepted: <span className="font-bold text-green-600">{totalAccepted}</span>
            </div>
            <div>
              Rejected: <span className="font-bold text-red-600">{totalRejected}</span>
            </div>
          </div>

          {/* Notes */}
          {grn.notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{grn.notes}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {canVerify && (
            <Button onClick={handleVerify} disabled={verifyGRN.isPending}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Verify & Update Inventory
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

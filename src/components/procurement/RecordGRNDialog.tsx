import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Package, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePurchaseOrder } from '@/hooks/usePurchaseOrders';
import { useCreateGRN } from '@/hooks/useGRN';

interface RecordGRNDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string | null;
}

interface GRNItemInput {
  po_item_id: string;
  product_id: string | null;
  description: string;
  ordered_quantity: number;
  previously_received: number;
  pending_quantity: number;
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  rejection_reason: string;
  batch_number: string;
}

export function RecordGRNDialog({ open, onOpenChange, poId }: RecordGRNDialogProps) {
  const { data: po, isLoading } = usePurchaseOrder(poId ?? undefined);
  const createGRN = useCreateGRN();
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<GRNItemInput[]>([]);

  useEffect(() => {
    if (po?.items) {
      setItems(
        po.items.map(item => ({
          po_item_id: item.id,
          product_id: item.product_id,
          description: item.description,
          ordered_quantity: item.quantity,
          previously_received: item.received_quantity || 0,
          pending_quantity: item.quantity - (item.received_quantity || 0),
          received_quantity: item.quantity - (item.received_quantity || 0),
          accepted_quantity: item.quantity - (item.received_quantity || 0),
          rejected_quantity: 0,
          rejection_reason: '',
          batch_number: '',
        }))
      );
    }
  }, [po]);

  const handleReceivedChange = (index: number, value: number) => {
    const newItems = [...items];
    const item = newItems[index];
    const maxReceivable = item.pending_quantity;
    const received = Math.min(Math.max(0, value), maxReceivable);
    
    item.received_quantity = received;
    item.accepted_quantity = received - item.rejected_quantity;
    setItems(newItems);
  };

  const handleRejectedChange = (index: number, value: number) => {
    const newItems = [...items];
    const item = newItems[index];
    const rejected = Math.min(Math.max(0, value), item.received_quantity);
    
    item.rejected_quantity = rejected;
    item.accepted_quantity = item.received_quantity - rejected;
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!po) return;

    const grnItems = items
      .filter(item => item.received_quantity > 0)
      .map(item => ({
        po_item_id: item.po_item_id,
        product_id: item.product_id,
        ordered_quantity: item.ordered_quantity,
        received_quantity: item.received_quantity,
        accepted_quantity: item.accepted_quantity,
        rejected_quantity: item.rejected_quantity,
        rejection_reason: item.rejection_reason || undefined,
        batch_number: item.batch_number || undefined,
      }));

    if (grnItems.length === 0) {
      return;
    }

    await createGRN.mutateAsync({
      po_id: po.id,
      supplier_id: po.supplier_id,
      received_date: receivedDate,
      notes: notes || undefined,
      items: grnItems,
    });

    onOpenChange(false);
  };

  const totalReceived = items.reduce((sum, item) => sum + item.received_quantity, 0);
  const totalAccepted = items.reduce((sum, item) => sum + item.accepted_quantity, 0);
  const totalRejected = items.reduce((sum, item) => sum + item.rejected_quantity, 0);

  if (isLoading || !po) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Record Goods Receipt - {po.po_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Supplier</Label>
              <p className="text-sm font-medium">{po.supplier?.name || '-'}</p>
            </div>
            <div>
              <Label htmlFor="received-date">Received Date</Label>
              <Input
                id="received-date"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Item</TableHead>
                  <TableHead className="text-center">Ordered</TableHead>
                  <TableHead className="text-center">Prev. Received</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-center">Receiving</TableHead>
                  <TableHead className="text-center">Rejected</TableHead>
                  <TableHead className="text-center">Accepted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.po_item_id}>
                    <TableCell>
                      <div className="font-medium">{item.description}</div>
                      {item.rejected_quantity > 0 && (
                        <Input
                          placeholder="Rejection reason..."
                          value={item.rejection_reason}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[index].rejection_reason = e.target.value;
                            setItems(newItems);
                          }}
                          className="mt-2 h-8 text-xs"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-center">{item.ordered_quantity}</TableCell>
                    <TableCell className="text-center">
                      {item.previously_received > 0 ? (
                        <Badge variant="secondary">{item.previously_received}</Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={item.pending_quantity > 0 ? 'outline' : 'secondary'}>
                        {item.pending_quantity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        max={item.pending_quantity}
                        value={item.received_quantity}
                        onChange={(e) => handleReceivedChange(index, Number(e.target.value))}
                        className="w-20 text-center mx-auto"
                        disabled={item.pending_quantity === 0}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        max={item.received_quantity}
                        value={item.rejected_quantity}
                        onChange={(e) => handleRejectedChange(index, Number(e.target.value))}
                        className="w-20 text-center mx-auto"
                        disabled={item.received_quantity === 0}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={item.accepted_quantity > 0 ? 'bg-green-500' : ''}>
                        {item.accepted_quantity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="flex gap-4 justify-end text-sm">
            <div>
              Total Receiving: <span className="font-bold">{totalReceived}</span>
            </div>
            <div>
              Accepted: <span className="font-bold text-green-600">{totalAccepted}</span>
            </div>
            <div>
              Rejected: <span className="font-bold text-red-600">{totalRejected}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this receipt..."
              rows={2}
            />
          </div>

          {totalReceived === 0 && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Enter quantities for at least one item to record receipt</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createGRN.isPending || totalReceived === 0}
          >
            {createGRN.isPending ? 'Recording...' : 'Record Receipt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUpdateSalesOrder, SalesOrder } from '@/hooks/useSalesOrders';
import { ArrowRight, Plane, MapPin, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpdateOrderStatusDialogProps {
  orderId: string;
  orderNumber: string;
  currentStatus: SalesOrder['status'];
  currentIsImport?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions: { value: SalesOrder['status']; label: string; description: string }[] = [
  { 
    value: 'pending_documents', 
    label: 'Pending Documents',
    description: 'Waiting for customer PO or payment receipt'
  },
  { 
    value: 'ready_for_procurement', 
    label: 'Ready for Procurement',
    description: 'Documents received, ready for procurement to process'
  },
  { 
    value: 'in_procurement', 
    label: 'In Procurement',
    description: 'Procurement team is working on supplier POs'
  },
  { 
    value: 'partially_fulfilled', 
    label: 'Partially Fulfilled',
    description: 'Some items received, pending complete delivery'
  },
  { 
    value: 'ready_to_dispatch', 
    label: 'Ready to Dispatch',
    description: 'All items received, ready for customer dispatch'
  },
  { 
    value: 'fulfilled', 
    label: 'Fulfilled',
    description: 'All items dispatched and delivered'
  },
  { 
    value: 'cancelled', 
    label: 'Cancelled',
    description: 'Order has been cancelled'
  },
  { 
    value: 'postponed', 
    label: 'Postponed',
    description: 'Order has been postponed to a later date'
  },
];

const statusColors: Record<string, string> = {
  pending_documents: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  ready_for_procurement: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_procurement: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  partially_fulfilled: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  ready_to_dispatch: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  fulfilled: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  postponed: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export function UpdateOrderStatusDialog({
  orderId,
  orderNumber,
  currentStatus,
  currentIsImport = false,
  open,
  onOpenChange,
}: UpdateOrderStatusDialogProps) {
  const [newStatus, setNewStatus] = useState<SalesOrder['status']>(currentStatus);
  const [isImport, setIsImport] = useState(currentIsImport);
  const [reason, setReason] = useState('');
  const [postponedUntil, setPostponedUntil] = useState<Date | undefined>();
  const updateOrder = useUpdateSalesOrder();

  const currentStatusLabel = statusOptions.find(s => s.value === currentStatus)?.label || currentStatus;
  const newStatusLabel = statusOptions.find(s => s.value === newStatus)?.label || newStatus;
  const newStatusDescription = statusOptions.find(s => s.value === newStatus)?.description || '';

  const hasChanges = newStatus !== currentStatus || isImport !== currentIsImport;
  const needsReason = newStatus === 'cancelled' || newStatus === 'postponed';
  const needsDate = newStatus === 'postponed';
  const isValid = hasChanges && (!needsReason || reason.trim().length > 0) && (!needsDate || postponedUntil);

  const handleSubmit = async () => {
    if (!isValid) return;

    await updateOrder.mutateAsync({
      id: orderId,
      status: newStatus,
      is_import: isImport,
      ...(newStatus === 'cancelled' ? { cancellation_reason: reason.trim(), status_change_reason: reason.trim() } : {}),
      ...(newStatus === 'postponed' ? { 
        postponed_until: postponedUntil ? format(postponedUntil, 'yyyy-MM-dd') : null,
        status_change_reason: reason.trim(),
      } : {}),
    } as any);

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Order Status</DialogTitle>
          <DialogDescription>
            Change status for {orderNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Badge className={statusColors[currentStatus]}>
              {currentStatusLabel}
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge className={statusColors[newStatus]}>
              {newStatusLabel}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label>New Status</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as SalesOrder['status'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {newStatusDescription && (
              <p className="text-xs text-muted-foreground">
                {newStatusDescription}
              </p>
            )}
          </div>

          {needsReason && (
            <div className="space-y-2">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder={newStatus === 'cancelled' ? 'Why is this order being cancelled?' : 'Why is this order being postponed?'}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {needsDate && (
            <div className="space-y-2">
              <Label>Postponed Until <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !postponedUntil && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {postponedUntil ? format(postponedUntil, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={postponedUntil}
                    onSelect={setPostponedUntil}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              {isImport ? (
                <Plane className="h-4 w-4 text-blue-500" />
              ) : (
                <MapPin className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="import-toggle" className="cursor-pointer">
                  Import Order
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mark this as an international import order
                </p>
              </div>
            </div>
            <Switch
              id="import-toggle"
              checked={isImport}
              onCheckedChange={setIsImport}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={updateOrder.isPending || !isValid}
          >
            {updateOrder.isPending ? 'Updating...' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

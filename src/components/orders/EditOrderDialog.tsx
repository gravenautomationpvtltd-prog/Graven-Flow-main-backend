import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateSalesOrder, SalesOrderWithDetails } from '@/hooks/useSalesOrders';
import { useUsersWithRoles } from '@/hooks/useUserManagement';
import { useAuth } from '@/hooks/useAuth';

interface EditOrderDialogProps {
  order: SalesOrderWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditOrderDialog({ order, open, onOpenChange }: EditOrderDialogProps) {
  const { isManager, isAdmin } = useAuth();
  const { data: usersWithRoles } = useUsersWithRoles();
  const updateOrder = useUpdateSalesOrder();
  
  const [notes, setNotes] = useState('');
  const [assignedProcurement, setAssignedProcurement] = useState<string>('');

  useEffect(() => {
    if (order) {
      setNotes(order.notes || '');
      setAssignedProcurement(order.assigned_procurement || '');
    }
  }, [order]);

  const handleSubmit = async () => {
    if (!order) return;

    await updateOrder.mutateAsync({
      id: order.id,
      notes: notes || null,
      assigned_procurement: assignedProcurement || null,
    });

    onOpenChange(false);
  };

  // Filter to only show active users with procurement role
  const procurementUsers = usersWithRoles?.filter(user => 
    user.is_active && user.roles.includes('procurement')
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Order</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {order?.order_number}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {(isManager || isAdmin) && (
            <div className="space-y-2">
              <Label>Assign to Procurement</Label>
              <Select 
                value={assignedProcurement || "__none__"} 
                onValueChange={(v) => setAssignedProcurement(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {procurementUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this order..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateOrder.isPending}>
            {updateOrder.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

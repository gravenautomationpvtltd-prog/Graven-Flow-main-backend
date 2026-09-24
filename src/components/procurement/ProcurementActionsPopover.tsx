import { useState } from 'react';
import { CalendarIcon, Settings2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';
import { cn } from '@/lib/utils';
import { useUsersWithRoles } from '@/hooks/useUserManagement';
import { useActiveSuppliers } from '@/hooks/useSuppliers';
import { useUpdateSalesOrder, useDeleteSalesOrder, SalesOrderWithDetails } from '@/hooks/useSalesOrders';
import { useAuth } from '@/hooks/useAuth';

interface ProcurementActionsPopoverProps {
  order: SalesOrderWithDetails;
  onClose?: () => void;
}

export function ProcurementActionsPopover({ order, onClose }: ProcurementActionsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const { isAdmin } = useAuth();
  const { data: users = [] } = useUsersWithRoles();
  const { data: suppliers = [] } = useActiveSuppliers();
  const deleteOrder = useDeleteSalesOrder();
  const updateOrder = useUpdateSalesOrder();

  // Filter procurement team members
  const procurementTeam = users.filter(u => 
    u.roles.some(r => ['procurement', 'manager', 'coo', 'super_admin'].includes(r)) && u.is_active
  );

  const [assignedTo, setAssignedTo] = useState<string>(order.assigned_procurement || '');
  const [orderType, setOrderType] = useState<string>(order.is_import ? 'import' : 'local');
  const [supplierId, setSupplierId] = useState<string>((order as any).preferred_supplier_id || '');
  const [expectedDate, setExpectedDate] = useState<Date | undefined>(
    (order as any).expected_arrival ? new Date((order as any).expected_arrival) : undefined
  );

  const handleSave = () => {
    updateOrder.mutate({
      id: order.id,
      assigned_procurement: assignedTo || null,
      is_import: orderType === 'import',
      preferred_supplier_id: supplierId || null,
      expected_arrival: expectedDate ? format(expectedDate, 'yyyy-MM-dd') : null,
    } as any);
    setOpen(false);
    onClose?.();
  };

  const handleCancel = () => {
    setOpen(false);
    onClose?.();
  };

  const handleDelete = async () => {
    await deleteOrder.mutateAsync(order.id);
    setDeleteDialogOpen(false);
    setOpen(false);
    onClose?.();
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Settings2 className="h-4 w-4 mr-1" />
            Actions
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80" 
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Procurement Actions</h4>

            {/* Assign To */}
            <div className="space-y-2">
              <Label className="text-xs">Assign To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {procurementTeam.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Toggle */}
            <div className="space-y-2">
              <Label className="text-xs">Order Type</Label>
              <ToggleGroup 
                type="single" 
                value={orderType} 
                onValueChange={(v) => v && setOrderType(v)}
                className="justify-start"
              >
                <ToggleGroupItem value="local" className="text-xs px-4">
                  Local
                </ToggleGroupItem>
                <ToggleGroupItem value="import" className="text-xs px-4">
                  Import
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Supplier */}
            <div className="space-y-2">
              <Label className="text-xs">Preferred Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expected Date */}
            <div className="space-y-2">
              <Label className="text-xs">Expected Arrival</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9",
                      !expectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expectedDate ? format(expectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expectedDate}
                    onSelect={(date) => {
                      setExpectedDate(date);
                      setDatePickerOpen(false);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateOrder.isPending}>
                Save
              </Button>
            </div>

            {/* Delete Option - CEO/COO only */}
            {isAdmin && (
              <>
                <Separator className="my-3" />
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Order
                </Button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Delete Confirmation Dialog - Outside Popover */}
      <DoubleConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Sales Order"
        description="This will permanently delete this sales order and all associated documents, purchase orders, invoices, and dispatches."
        itemDetails={
          <>
            <p><strong>Order #:</strong> {order.order_number}</p>
            <p><strong>Customer:</strong> {order.customer?.company_name || '—'}</p>
            <p><strong>Value:</strong> ₹{(order.order_value || 0).toLocaleString()}</p>
          </>
        }
        isLoading={deleteOrder.isPending}
      />
    </>
  );
}

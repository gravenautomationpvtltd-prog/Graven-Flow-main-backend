import { useState } from 'react';
import { format } from 'date-fns';
import { Eye, MoreHorizontal, Trash2, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDispatches, useDeleteDispatch, Dispatch } from '@/hooks/useDispatches';
import { ViewDispatchDialog } from './ViewDispatchDialog';
import { useAuth } from '@/hooks/useAuth';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';

interface DispatchesTableProps {
  searchQuery?: string;
  statusFilter?: string;
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

export function DispatchesTable({ searchQuery = '', statusFilter = 'all' }: DispatchesTableProps) {
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dispatchToDelete, setDispatchToDelete] = useState<Dispatch | null>(null);

  const { data: dispatches = [], isLoading } = useDispatches();
  const deleteDispatch = useDeleteDispatch();
  const { isAdmin } = useAuth();

  const filteredDispatches = dispatches.filter(dispatch => {
    const matchesSearch = 
      dispatch.dispatch_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dispatch.customer?.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dispatch.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || dispatch.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleView = (dispatch: Dispatch) => {
    setSelectedDispatchId(dispatch.id);
    setViewDialogOpen(true);
  };

  const handleDelete = async () => {
    if (dispatchToDelete) {
      await deleteDispatch.mutateAsync(dispatchToDelete.id);
      setDeleteDialogOpen(false);
      setDispatchToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading dispatches...
      </div>
    );
  }

  if (filteredDispatches.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {searchQuery || statusFilter !== 'all' 
          ? 'No dispatches match your filters' 
          : 'No dispatches yet. Create your first dispatch!'}
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dispatch #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Quotation</TableHead>
              <TableHead>Dispatch Date</TableHead>
              <TableHead>Courier</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDispatches.map((dispatch) => (
              <TableRow key={dispatch.id} className="cursor-pointer" onClick={() => handleView(dispatch)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{dispatch.dispatch_number}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {dispatch.customer?.company_name || '-'}
                </TableCell>
                <TableCell>
                  {dispatch.quotation?.quotation_number || '-'}
                </TableCell>
                <TableCell>
                  {dispatch.dispatch_date ? format(new Date(dispatch.dispatch_date), 'dd MMM yyyy') : '-'}
                </TableCell>
                <TableCell>
                  {dispatch.courier_name || '-'}
                </TableCell>
                <TableCell>
                  {dispatch.tracking_number || '-'}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[dispatch.status] || 'bg-muted'}>
                    {statusLabels[dispatch.status] || dispatch.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(dispatch); }}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDispatchToDelete(dispatch);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ViewDispatchDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        dispatchId={selectedDispatchId}
      />

      <DoubleConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Dispatch"
        description="This will permanently delete this dispatch and all associated documents."
        itemDetails={dispatchToDelete && (
          <>
            <p><strong>Dispatch #:</strong> {dispatchToDelete.dispatch_number}</p>
            <p><strong>Customer:</strong> {dispatchToDelete.customer?.company_name || '-'}</p>
            <p><strong>Tracking:</strong> {dispatchToDelete.tracking_number || '-'}</p>
          </>
        )}
        isLoading={deleteDispatch.isPending}
      />
    </>
  );
}
import { useState } from 'react';
import { format } from 'date-fns';
import { Eye, FileText, MoreHorizontal, Pencil, Trash2, Copy } from 'lucide-react';
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
import { usePurchaseOrders, useDeletePurchaseOrder, useClonePurchaseOrder, PurchaseOrder } from '@/hooks/usePurchaseOrders';
import { ViewPODialog } from './ViewPODialog';
import { EditPODialog } from './EditPODialog';
import { useAuth } from '@/hooks/useAuth';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';

interface PurchaseOrdersTableProps {
  searchQuery?: string;
  statusFilter?: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  sent: 'bg-blue-100 text-blue-800',
  acknowledged: 'bg-purple-100 text-purple-800',
  partial: 'bg-yellow-100 text-yellow-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function PurchaseOrdersTable({ searchQuery = '', statusFilter = 'all' }: PurchaseOrdersTableProps) {
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [poToDelete, setPOToDelete] = useState<PurchaseOrder | null>(null);

  const { data: purchaseOrders = [], isLoading } = usePurchaseOrders();
  const deletePO = useDeletePurchaseOrder();
  const clonePO = useClonePurchaseOrder();
  const { isAdmin, isManager } = useAuth();

  const handleClone = async (po: PurchaseOrder) => {
    await clonePO.mutateAsync(po.id);
  };

  // Group status mapping for card filters
  const getStatusesToFilter = (filter: string): string[] => {
    switch (filter) {
      case 'pending_group':
        return ['draft', 'sent', 'acknowledged', 'pending_verification', 'pending_authorization', 'pending_approval'];
      default:
        return [filter];
    }
  };

  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = 
      po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else {
      const statusesToMatch = getStatusesToFilter(statusFilter);
      matchesStatus = statusesToMatch.includes(po.status);
    }
    
    return matchesSearch && matchesStatus;
  });

  const handleView = (po: PurchaseOrder) => {
    setSelectedPOId(po.id);
    setViewDialogOpen(true);
  };

  const handleEdit = (po: PurchaseOrder) => {
    setSelectedPOId(po.id);
    setEditDialogOpen(true);
  };

  const canEdit = (po: PurchaseOrder) => {
    // Can only edit draft or rejected POs (not pending_approval/approved/delivered/cancelled)
    return ['draft', 'rejected'].includes(po.status) && (isAdmin || isManager);
  };

  const handleDelete = async () => {
    if (poToDelete) {
      await deletePO.mutateAsync(poToDelete.id);
      setDeleteDialogOpen(false);
      setPOToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading purchase orders...
      </div>
    );
  }

  if (filteredPOs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {searchQuery || statusFilter !== 'all' 
          ? 'No purchase orders match your filters' 
          : 'No purchase orders yet. Create your first PO!'}
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Expected Delivery</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPOs.map((po) => (
              <TableRow key={po.id} className="cursor-pointer" onClick={() => handleView(po)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{po.po_number}</span>
                    {(po as any).supplier_quotation_id && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        From RFQ
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {po.supplier?.name || '-'}
                </TableCell>
                <TableCell>
                  {po.order_date ? format(new Date(po.order_date), 'dd MMM yyyy') : '-'}
                </TableCell>
                <TableCell>
                  {po.expected_delivery ? format(new Date(po.expected_delivery), 'dd MMM yyyy') : '-'}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[po.status] || 'bg-muted'}>
                    {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  ₹{po.grand_total.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(po); }}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {canEdit(po) && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(po); }}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleClone(po); }}>
                        <Copy className="mr-2 h-4 w-4" />
                        Clone PO
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPOToDelete(po);
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

      <ViewPODialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        poId={selectedPOId}
      />

      <EditPODialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        poId={selectedPOId}
      />

      <DoubleConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Purchase Order"
        description="This will permanently delete this purchase order and all associated data."
        itemDetails={poToDelete && (
          <>
            <p><strong>PO #:</strong> {poToDelete.po_number}</p>
            <p><strong>Supplier:</strong> {poToDelete.supplier?.name || '-'}</p>
            <p><strong>Total:</strong> ₹{poToDelete.grand_total.toFixed(2)}</p>
          </>
        )}
        isLoading={deletePO.isPending}
      />
    </>
  );
}
import { useState } from 'react';
import { format } from 'date-fns';
import { Eye, MoreHorizontal, CheckCircle, Trash2, Package } from 'lucide-react';
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
import { useGRNs, useVerifyGRN, useDeleteGRN } from '@/hooks/useGRN';
import { ViewGRNDialog } from './ViewGRNDialog';
import { useAuth } from '@/hooks/useAuth';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';

interface GRNListTableProps {
  searchQuery?: string;
  statusFilter?: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  verified: 'bg-green-100 text-green-800',
  posted: 'bg-blue-100 text-blue-800',
};

export function GRNListTable({ searchQuery = '', statusFilter = 'all' }: GRNListTableProps) {
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedGRNId, setSelectedGRNId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [grnToDelete, setGrnToDelete] = useState<{
    id: string;
    grn_number: string;
    po_number?: string;
    supplier_name?: string;
  } | null>(null);

  const { data: grns = [], isLoading } = useGRNs();
  const verifyGRN = useVerifyGRN();
  const deleteGRN = useDeleteGRN();
  const { isAdmin, isManager } = useAuth();

  const filteredGRNs = grns.filter(grn => {
    const matchesSearch = 
      grn.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grn.purchase_order?.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grn.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || grn.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleView = (grnId: string) => {
    setSelectedGRNId(grnId);
    setViewDialogOpen(true);
  };

  const handleVerify = async (grnId: string) => {
    await verifyGRN.mutateAsync(grnId);
  };

  const handleDelete = async () => {
    if (grnToDelete) {
      await deleteGRN.mutateAsync(grnToDelete.id);
      setDeleteDialogOpen(false);
      setGrnToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading goods receipts...
      </div>
    );
  }

  if (filteredGRNs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {searchQuery || statusFilter !== 'all'
          ? 'No goods receipts match your filters'
          : 'No goods receipts recorded yet'}
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GRN Number</TableHead>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Received Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Received By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGRNs.map((grn) => (
              <TableRow key={grn.id} className="cursor-pointer" onClick={() => handleView(grn.id)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{grn.grn_number}</span>
                  </div>
                </TableCell>
                <TableCell>{grn.purchase_order?.po_number || '-'}</TableCell>
                <TableCell>{grn.supplier?.name || '-'}</TableCell>
                <TableCell>
                  {grn.received_date ? format(new Date(grn.received_date), 'dd MMM yyyy') : '-'}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[grn.status] || 'bg-muted'}>
                    {grn.status.charAt(0).toUpperCase() + grn.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>{grn.receiver?.full_name || '-'}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(grn.id); }}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {grn.status === 'pending' && (isAdmin || isManager) && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleVerify(grn.id); }}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Verify & Update Inventory
                        </DropdownMenuItem>
                      )}
                      {isAdmin && grn.status === 'pending' && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGrnToDelete({
                              id: grn.id,
                              grn_number: grn.grn_number,
                              po_number: grn.purchase_order?.po_number,
                              supplier_name: grn.supplier?.name,
                            });
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

      <ViewGRNDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        grnId={selectedGRNId}
      />

      <DoubleConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Goods Receipt"
        description="This will permanently delete this GRN and all associated data."
        itemDetails={grnToDelete && (
          <>
            <p><strong>GRN #:</strong> {grnToDelete.grn_number}</p>
            <p><strong>PO #:</strong> {grnToDelete.po_number || '-'}</p>
            <p><strong>Supplier:</strong> {grnToDelete.supplier_name || '-'}</p>
          </>
        )}
        isLoading={deleteGRN.isPending}
      />
    </>
  );
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, ExternalLink } from 'lucide-react';
import { useSupplierPurchaseOrders } from '@/hooks/useSupplierDetail';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface SupplierPOsTableProps {
  supplierId: string;
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'secondary',
    sent: 'outline',
    acknowledged: 'outline',
    pending_verification: 'secondary',
    pending_authorization: 'secondary',
    pending_approval: 'secondary',
    approved: 'default',
    partial: 'outline',
    delivered: 'default',
    cancelled: 'destructive',
    rejected: 'destructive',
  };
  return <Badge variant={variants[status] || 'secondary'}>{status.replace(/_/g, ' ')}</Badge>;
};

export function SupplierPOsTable({ supplierId }: SupplierPOsTableProps) {
  const { data: pos, isLoading } = useSupplierPurchaseOrders(supplierId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Purchase Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Purchase Orders ({pos?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!pos || pos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No purchase orders found
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pos.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.po_number}</TableCell>
                    <TableCell>
                      {po.order_date ? format(new Date(po.order_date), 'dd MMM yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      {po.currency === 'USD' ? '$' : '₹'}
                      {(po.grand_total || 0).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>{getStatusBadge(po.status)}</TableCell>
                    <TableCell>
                      {(po.created_by_profile as any)?.full_name || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/procurement?tab=orders&search=${po.po_number}`)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

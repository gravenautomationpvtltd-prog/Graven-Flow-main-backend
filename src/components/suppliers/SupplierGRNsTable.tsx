import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package } from 'lucide-react';
import { useSupplierGRNs } from '@/hooks/useSupplierDetail';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface SupplierGRNsTableProps {
  supplierId: string;
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    completed: 'default',
    partial: 'outline',
  };
  return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
};

export function SupplierGRNsTable({ supplierId }: SupplierGRNsTableProps) {
  const { data: grns, isLoading } = useSupplierGRNs(supplierId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Goods Receipt Notes
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Goods Receipt Notes ({grns?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!grns || grns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No GRNs found
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN Number</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grns.map((grn) => (
                  <TableRow key={grn.id}>
                    <TableCell className="font-medium">{grn.grn_number}</TableCell>
                    <TableCell>{(grn.po as any)?.po_number || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(grn.received_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>{getStatusBadge(grn.status)}</TableCell>
                    <TableCell>
                      {(grn.received_by_profile as any)?.full_name || '-'}
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

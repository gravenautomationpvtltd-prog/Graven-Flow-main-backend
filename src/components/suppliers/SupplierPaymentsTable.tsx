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
import { IndianRupee } from 'lucide-react';
import { useSupplierPayments } from '@/hooks/useSupplierDetail';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface SupplierPaymentsTableProps {
  supplierId: string;
}

export function SupplierPaymentsTable({ supplierId }: SupplierPaymentsTableProps) {
  const { data: payments, isLoading } = useSupplierPayments(supplierId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Payments History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  const totalPaid = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5" />
          Payments History ({payments?.length || 0})
        </CardTitle>
        <Badge variant="outline" className="text-base px-3 py-1">
          Total: ₹{totalPaid.toLocaleString('en-IN')}
        </Badge>
      </CardHeader>
      <CardContent>
        {!payments || payments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No payments recorded
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Paid By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>{(payment.po as any)?.po_number || '-'}</TableCell>
                    <TableCell className="font-medium">
                      ₹{payment.amount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {payment.payment_mode?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {payment.transaction_reference || '-'}
                    </TableCell>
                    <TableCell>
                      {(payment.paid_by_profile as any)?.full_name || '-'}
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

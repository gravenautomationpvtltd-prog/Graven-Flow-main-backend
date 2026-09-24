import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmployeeOrders, DateRangeParam } from '@/hooks/useEmployeeStats';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  confirmed: 'bg-blue-500/10 text-blue-500',
  processing: 'bg-purple-500/10 text-purple-500',
  shipped: 'bg-cyan-500/10 text-cyan-500',
  delivered: 'bg-green-500/10 text-green-500',
  cancelled: 'bg-red-500/10 text-red-500',
};

interface EmployeeOrdersTableProps {
  employeeId: string;
  dateRange?: DateRangeParam;
}

export function EmployeeOrdersTable({ employeeId, dateRange }: EmployeeOrdersTableProps) {
  const { data: orders, isLoading } = useEmployeeOrders(employeeId, dateRange);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!orders?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No orders from this employee's leads</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">{order.order_number}</TableCell>
              <TableCell>{order.lead?.customer?.company_name || '—'}</TableCell>
              <TableCell>
                <Badge className={statusColors[order.status] || ''}>
                  {order.status}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">
                ₹{(order.order_value || 0).toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {order.payment_status || 'pending'}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(order.created_at), 'MMM d, yyyy')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

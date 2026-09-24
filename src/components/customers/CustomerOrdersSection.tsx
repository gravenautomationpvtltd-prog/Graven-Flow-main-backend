import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingBag, ExternalLink } from 'lucide-react';
import { useCustomerOrders } from '@/hooks/useCustomerStats';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CustomerOrdersSectionProps {
  customerId: string;
}

const statusColors: Record<string, string> = {
  pending_documents: 'bg-yellow-100 text-yellow-800',
  ready_for_procurement: 'bg-blue-100 text-blue-800',
  in_procurement: 'bg-purple-100 text-purple-800',
  ready_for_dispatch: 'bg-indigo-100 text-indigo-800',
  dispatched: 'bg-cyan-100 text-cyan-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  pending_documents: 'Pending Docs',
  ready_for_procurement: 'Ready for Proc.',
  in_procurement: 'In Procurement',
  ready_for_dispatch: 'Ready to Ship',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function CustomerOrdersSection({ customerId }: CustomerOrdersSectionProps) {
  const navigate = useNavigate();
  const { data: orders, isLoading } = useCustomerOrders(customerId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingBag className="h-5 w-5" />
          Orders ({orders?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!orders || orders.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No orders yet
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{format(new Date(order.created_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{formatCurrency(order.order_value || 0)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[order.status] || 'bg-muted'}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.lead_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/leads/${order.lead_id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
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

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plane, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSalesOrders, SalesOrderWithDetails } from '@/hooks/useSalesOrders';
import { format } from 'date-fns';
import { ProcurementActionsPopover } from './ProcurementActionsPopover';

interface SalesOrdersTableProps {
  searchQuery: string;
  statusFilter: string;
}

const statusColors: Record<string, string> = {
  pending_documents: 'bg-gray-500',
  ready_for_procurement: 'bg-amber-500',
  in_procurement: 'bg-blue-500',
  partially_fulfilled: 'bg-purple-500',
  ready_to_dispatch: 'bg-cyan-500',
  fulfilled: 'bg-green-500',
  cancelled: 'bg-red-500',
  postponed: 'bg-orange-500',
};

const statusLabels: Record<string, string> = {
  pending_documents: 'Pending Docs',
  ready_for_procurement: 'Ready',
  in_procurement: 'In Procurement',
  partially_fulfilled: 'Partial',
  ready_to_dispatch: 'Ready to Dispatch',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  postponed: 'Postponed',
};

export function SalesOrdersTable({ searchQuery, statusFilter }: SalesOrdersTableProps) {
  const navigate = useNavigate();
  const { data: orders = [], isLoading } = useSalesOrders('all');

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        order.order_number.toLowerCase().includes(searchLower) ||
        order.customer?.company_name?.toLowerCase().includes(searchLower) ||
        order.lead?.title?.toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const handleRowClick = (orderId: string) => {
    navigate(`/orders/${orderId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (filteredOrders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-lg mb-1">No Orders Found</h3>
          <p className="text-muted-foreground text-sm">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Orders will appear here when created'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Company</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Expected</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredOrders.map((order) => (
            <TableRow
              key={order.id}
              onClick={() => handleRowClick(order.id)}
              className="cursor-pointer hover:bg-muted/50"
            >
              <TableCell className="font-medium">{order.order_number}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy') : '—'}
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">
                    {order.customer?.company_name || (
                      order.customer_id ? (
                        <span className="text-muted-foreground italic">Access restricted</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
                    )}
                  </p>
                  {order.lead?.title && (
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {order.lead.title}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-semibold">
                ₹{(order.quotation?.grand_total ?? order.order_value)?.toLocaleString()}
              </TableCell>
              <TableCell>
                {/* Priority: Linked PO > Preferred Supplier > None */}
                {order.linked_po_summary && order.linked_po_summary.length > 0 ? (
                  <span className="text-sm">
                    {order.linked_po_summary.length > 1 
                      ? `${order.linked_po_summary[0].supplier_name} +${order.linked_po_summary.length - 1}`
                      : order.linked_po_summary[0].supplier_name
                    }
                  </span>
                ) : order.preferred_supplier ? (
                  <span className="text-sm text-muted-foreground italic">
                    {order.preferred_supplier.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell>
                {/* Priority: Linked PO delivery > expected_arrival > None */}
                {(() => {
                  const deliveries = (order.linked_po_summary || [])
                    .map(po => po.expected_delivery)
                    .filter(Boolean) as string[];
                  if (deliveries.length > 0) {
                    const earliest = deliveries.sort()[0];
                    return <span className="text-sm">{format(new Date(earliest), 'dd MMM')}</span>;
                  }
                  if (order.expected_arrival) {
                    return <span className="text-sm text-muted-foreground italic">{format(new Date(order.expected_arrival), 'dd MMM')}</span>;
                  }
                  return <span className="text-muted-foreground text-sm">—</span>;
                })()}
              </TableCell>
              <TableCell>
                {order.assigned_procurement_profile ? (
                  <Badge variant="secondary" className="font-normal">
                    {order.assigned_procurement_profile.full_name}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                <Badge className={`${statusColors[order.status] || 'bg-gray-500'} text-white`}>
                  {statusLabels[order.status] || order.status}
                </Badge>
              </TableCell>
              <TableCell>
                {order.is_import ? (
                  <Badge variant="outline" className="border-blue-500 text-blue-600 gap-1">
                    <Plane className="h-3 w-3" />
                    Import
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-gray-400 text-muted-foreground gap-1">
                    <MapPin className="h-3 w-3" />
                    Local
                  </Badge>
                )}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <ProcurementActionsPopover order={order} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

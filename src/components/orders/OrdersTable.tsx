import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MoreHorizontal, 
  Eye, 
  FileText, 
  ExternalLink, 
  Pencil, 
  RefreshCw, 
  IndianRupee, 
  Upload,
  Trash2
} from 'lucide-react';
import { SalesOrderWithDetails, useDeleteSalesOrder } from '@/hooks/useSalesOrders';
import { useAuth } from '@/hooks/useAuth';
import { ViewOrderDialog } from './ViewOrderDialog';
import { EditOrderDialog } from './EditOrderDialog';
import { UpdateOrderStatusDialog } from './UpdateOrderStatusDialog';
import { OrderPaymentDialog } from './OrderPaymentDialog';
import { UploadOrderDocumentDialog } from './UploadOrderDocumentDialog';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';

interface OrdersTableProps {
  orders: SalesOrderWithDetails[];
  isLoading: boolean;
}

const statusColors: Record<string, string> = {
  pending_documents: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  ready_for_procurement: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_procurement: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  partially_fulfilled: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  fulfilled: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  postponed: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

const statusLabels: Record<string, string> = {
  pending_documents: 'Pending Documents',
  ready_for_procurement: 'Ready for Procurement',
  in_procurement: 'In Procurement',
  partially_fulfilled: 'Partially Fulfilled',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  postponed: 'Postponed',
};

const paymentColors: Record<string, string> = {
  pending: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  received: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export function OrdersTable({ orders, isLoading }: OrdersTableProps) {
  const navigate = useNavigate();
  const { user, isManager, isAdmin, isProcurement } = useAuth();
  const deleteOrder = useDeleteSalesOrder();
  
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<SalesOrderWithDetails | null>(null);
  const [statusOrder, setStatusOrder] = useState<SalesOrderWithDetails | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<SalesOrderWithDetails | null>(null);
  const [uploadOrder, setUploadOrder] = useState<SalesOrderWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<SalesOrderWithDetails | null>(null);

  // Check if user can edit this order
  const canEditOrder = (order: SalesOrderWithDetails) => {
    if (isManager || isAdmin) return true;
    return order.created_by === user?.id;
  };

  // Check if user can update status (procurement, managers, or order creator)
  const canUpdateStatus = (order: SalesOrderWithDetails) => {
    if (isManager || isAdmin || isProcurement) return true;
    return order.created_by === user?.id;
  };

  // Check if user can record payment (sales creator or managers)
  const canRecordPayment = (order: SalesOrderWithDetails) => {
    if (isManager || isAdmin) return true;
    return order.created_by === user?.id;
  };

  const handleDelete = async () => {
    if (orderToDelete) {
      await deleteOrder.mutateAsync(orderToDelete.id);
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Net Sales</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No orders found</h3>
        <p className="text-muted-foreground mt-1">
          Orders will appear here when leads are converted.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Net Sales</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow 
                key={order.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setViewOrderId(order.id)}
              >
                <TableCell className="font-medium">
                  {order.order_number}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{order.customer?.company_name || '-'}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.customer?.contact_person}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  <div>₹{Math.round(order.net_value ?? order.order_value ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Net</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge className={paymentColors[order.payment_status] || paymentColors.pending}>
                      {order.payment_status?.charAt(0).toUpperCase() + order.payment_status?.slice(1) || 'Pending'}
                    </Badge>
                    {order.payment_amount > 0 && order.payment_status !== 'received' && (
                      <span className="text-xs text-muted-foreground">
                        ₹{order.payment_amount.toLocaleString()} received
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[order.status] || statusColors.pending_documents}>
                    {statusLabels[order.status] || order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {order.creator?.full_name || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(order.created_at), 'dd MMM yyyy')}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewOrderId(order.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      
                      {canEditOrder(order) && (
                        <DropdownMenuItem onClick={() => setEditOrder(order)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Order
                        </DropdownMenuItem>
                      )}
                      
                      {canUpdateStatus(order) && (
                        <DropdownMenuItem onClick={() => setStatusOrder(order)}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Update Status
                        </DropdownMenuItem>
                      )}
                      
                      {canRecordPayment(order) && order.payment_status !== 'received' && (
                        <DropdownMenuItem onClick={() => setPaymentOrder(order)}>
                          <IndianRupee className="mr-2 h-4 w-4" />
                          Record Payment
                        </DropdownMenuItem>
                      )}
                      
                      {canEditOrder(order) && (
                        <DropdownMenuItem onClick={() => setUploadOrder(order)}>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Document
                        </DropdownMenuItem>
                      )}
                      
                      {/* Only show lead/customer links to sales users and managers, not procurement-only users */}
                      {(isManager || isAdmin || !isProcurement) && (
                        <>
                          <DropdownMenuSeparator />
                          
                          {order.lead_id && (
                            <DropdownMenuItem onClick={() => navigate(`/leads/${order.lead_id}`)}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Lead
                            </DropdownMenuItem>
                          )}
                          {order.customer_id && (
                            <DropdownMenuItem onClick={() => navigate(`/customers/${order.customer_id}`)}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Customer
                            </DropdownMenuItem>
                          )}
                        </>
                      )}

                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setOrderToDelete(order);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <ViewOrderDialog
        orderId={viewOrderId}
        open={!!viewOrderId}
        onOpenChange={(open) => !open && setViewOrderId(null)}
      />

      <EditOrderDialog
        order={editOrder}
        open={!!editOrder}
        onOpenChange={(open) => !open && setEditOrder(null)}
      />

      {statusOrder && (
        <UpdateOrderStatusDialog
          orderId={statusOrder.id}
          orderNumber={statusOrder.order_number}
          currentStatus={statusOrder.status}
          open={!!statusOrder}
          onOpenChange={(open) => !open && setStatusOrder(null)}
        />
      )}

      <OrderPaymentDialog
        order={paymentOrder}
        open={!!paymentOrder}
        onOpenChange={(open) => !open && setPaymentOrder(null)}
      />

      {uploadOrder && (
        <UploadOrderDocumentDialog
          orderId={uploadOrder.id}
          orderNumber={uploadOrder.order_number}
          open={!!uploadOrder}
          onOpenChange={(open) => !open && setUploadOrder(null)}
        />
      )}

      <DoubleConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Sales Order"
        description="This will permanently delete this sales order and all associated documents."
        itemDetails={orderToDelete && (
          <>
            <p><strong>Order #:</strong> {orderToDelete.order_number}</p>
            <p><strong>Customer:</strong> {orderToDelete.customer?.company_name || '-'}</p>
            <p><strong>Value:</strong> ₹{(orderToDelete.order_value || 0).toLocaleString()}</p>
          </>
        )}
        isLoading={deleteOrder.isPending}
      />
    </>
  );
}
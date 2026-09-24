import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, FileText, Receipt, Eye, PlayCircle, Search, Package, Download, Target, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSalesOrders, useOrderDocuments, useUpdateSalesOrder, SalesOrderWithDetails } from '@/hooks/useSalesOrders';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { downloadFile } from '@/lib/download-utils';

// Hook to fetch quotation items with target rates
function useQuotationItemsWithTargets(quotationId: string | null | undefined) {
  return useQuery({
    queryKey: ['quotation-items-targets', quotationId],
    queryFn: async () => {
      if (!quotationId) return [];
      const { data, error } = await supabase
        .from('quotation_items')
        .select('id, description, quantity, rate, target_rate, hsn_code, amount')
        .eq('quotation_id', quotationId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!quotationId,
  });
}

const paymentStatusColors = {
  pending: 'bg-red-500',
  partial: 'bg-yellow-500',
  received: 'bg-green-500',
};

export function PendingOrdersTab() {
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SalesOrderWithDetails | null>(null);
  const { data: orders = [], isLoading } = useSalesOrders('ready_for_procurement');
  const updateOrder = useUpdateSalesOrder();
  const navigate = useNavigate();

  const filteredOrders = orders.filter((order) => {
    const searchLower = search.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(searchLower) ||
      order.customer?.company_name?.toLowerCase().includes(searchLower) ||
      order.lead?.title?.toLowerCase().includes(searchLower)
    );
  });

  const handleStartProcurement = async (order: SalesOrderWithDetails) => {
    await updateOrder.mutateAsync({
      id: order.id,
      status: 'in_procurement',
    });
    // Navigate to create PO with pre-filled data
    navigate(`/procurement?createPO=true&salesOrderId=${order.id}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-1">No Pending Orders</h3>
            <p className="text-muted-foreground text-sm">
              When sales records customer orders, they will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_number}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{order.customer?.company_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.customer?.contact_person}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{order.lead?.title || '-'}</TableCell>
                  <TableCell className="font-semibold">
                    ₹{order.order_value?.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${paymentStatusColors[order.payment_status]} text-white`}>
                      {order.payment_status === 'received'
                        ? 'Paid'
                        : order.payment_status === 'partial'
                        ? `Partial (₹${order.payment_amount?.toLocaleString()})`
                        : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(order.created_at), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleStartProcurement(order)}
                        disabled={updateOrder.isPending}
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Start Procurement
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* View Order Dialog */}
      {selectedOrder && (
        <ViewOrderDialog
          order={selectedOrder}
          open={!!selectedOrder}
          onOpenChange={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}

function ViewOrderDialog({
  order,
  open,
  onOpenChange,
}: {
  order: SalesOrderWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: documents = [] } = useOrderDocuments(order.id);
  const { data: quotationItems = [] } = useQuotationItemsWithTargets(order.quotation_id);
  const customerPO = documents.find((d) => d.document_type === 'customer_po');
  const paymentReceipt = documents.find((d) => d.document_type === 'payment_receipt');

  // Calculate target totals
  const itemsWithTargets = quotationItems.filter(item => item.target_rate !== null);
  const totalTargetValue = itemsWithTargets.reduce((sum, item) => 
    sum + ((item.target_rate || 0) * (item.quantity || 1)), 0
  );
  const totalQuotedValue = quotationItems.reduce((sum, item) => 
    sum + (item.amount || 0), 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order {order.order_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{order.customer?.company_name}</p>
              <p className="text-sm text-muted-foreground">{order.customer?.contact_person}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lead</p>
              <p className="font-medium">{order.lead?.title || '-'}</p>
            </div>
          </div>

          {/* Order Value */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Order Value</p>
              <p className="text-xl font-bold">₹{order.order_value?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Received</p>
              <p className="text-xl font-bold">₹{order.payment_amount?.toLocaleString()}</p>
            </div>
          </div>

          {/* Quotation */}
          {order.quotation && (
            <div>
              <p className="text-sm text-muted-foreground">Linked Quotation</p>
              <p className="font-medium">
                {order.quotation.quotation_number} - ₹{order.quotation.grand_total?.toLocaleString()}
              </p>
            </div>
          )}

          {/* Line Items with Target Prices - Key Section for Procurement */}
          {quotationItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-600" />
                  Line Items with Target Prices
                </p>
                {itemsWithTargets.length > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    {itemsWithTargets.length} items with targets
                  </Badge>
                )}
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Quoted Rate</TableHead>
                      <TableHead className="text-right">Target Rate</TableHead>
                      <TableHead className="text-right">Gap</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotationItems.map((item) => {
                      const hasTarget = item.target_rate !== null;
                      const gap = hasTarget ? (item.rate || 0) - (item.target_rate || 0) : null;
                      
                      return (
                        <TableRow key={item.id} className={hasTarget ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                          <TableCell className="max-w-[200px]">
                            <p className="font-medium truncate">{item.description}</p>
                            {item.hsn_code && (
                              <p className="text-xs text-muted-foreground">HSN: {item.hsn_code}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">₹{item.rate?.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            {hasTarget ? (
                              <span className="font-semibold text-amber-700 dark:text-amber-400">
                                ₹{item.target_rate?.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {gap !== null ? (
                              <span className={gap > 0 ? 'text-red-600' : 'text-green-600'}>
                                {gap > 0 ? '+' : ''}₹{gap.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {/* Summary for Procurement */}
              {itemsWithTargets.length > 0 && (
                <div className="flex justify-end gap-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Target Value</p>
                    <p className="font-semibold text-amber-700 dark:text-amber-400">
                      ₹{totalTargetValue.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Quoted</p>
                    <p className="font-semibold">
                      ₹{totalQuotedValue.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Documents */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Documents</p>
            <div className="flex flex-wrap gap-2">
              {customerPO && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => downloadFile(customerPO.file_url, customerPO.file_name)}
                >
                  <FileText className="h-4 w-4 text-blue-600" />
                  Customer PO
                  <Download className="h-3 w-3" />
                </Button>
              )}
              {paymentReceipt && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => downloadFile(paymentReceipt.file_url, paymentReceipt.file_name)}
                >
                  <Receipt className="h-4 w-4 text-green-600" />
                  Payment Receipt
                  <Download className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes from Sales</p>
              <p className="text-sm p-3 bg-muted rounded-lg">{order.notes}</p>
            </div>
          )}

          {/* Created Info */}
          <div className="text-sm text-muted-foreground">
            Created on {format(new Date(order.created_at), 'dd MMM yyyy, hh:mm a')}
            {order.creator && ` by ${order.creator.full_name}`}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

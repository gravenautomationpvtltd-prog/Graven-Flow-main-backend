import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ExternalLink, Eye, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';
import { CopyableText } from '@/components/shared/CopyableText';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: { from?: Date; to?: Date };
  assignedTo?: string;
}

export function RevenueDrilldownDialog({ open, onOpenChange, dateRange, assignedTo }: Props) {
  const navigate = useNavigate();

  const { data: result = { orders: [], totalRevenue: 0, totalCount: 0 }, isLoading } = useQuery({
    queryKey: ['drilldown-revenue', dateRange.from?.toISOString(), dateRange.to?.toISOString(), assignedTo ?? null],
    queryFn: async () => {
      let query = supabase
        .from('sales_orders')
        .select('*, customer:customers(company_name)')
        .eq('payment_status', 'received')
        .order('created_at', { ascending: false })
        .limit(50);

      let sumQuery = supabase
        .from('sales_orders')
        .select('payment_amount', { count: 'exact' })
        .eq('payment_status', 'received');

      if (dateRange.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
        sumQuery = sumQuery.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
        sumQuery = sumQuery.lte('created_at', dateRange.to.toISOString());
      }
      if (assignedTo) {
        query = query.eq('created_by', assignedTo);
        sumQuery = sumQuery.eq('created_by', assignedTo);
      }

      const [{ data: orders, error: oErr }, { data: allPaid, count: totalCount, error: sErr }] = await Promise.all([
        query,
        sumQuery,
      ]);

      if (oErr) throw oErr;
      if (sErr) throw sErr;

      const totalRevenue = (allPaid || []).reduce((sum: number, o: any) => sum + (Number(o.payment_amount) || 0), 0);

      return { orders: orders || [], totalRevenue, totalCount: totalCount || 0 };
    },
    enabled: open,
    staleTime: 10_000,
  });

  const orders = result.orders;
  const totalRevenue = result.totalRevenue;
  const avgOrderValue = result.totalCount > 0 ? totalRevenue / result.totalCount : 0;

  const formatCurrency = (val: number) => `₹${Math.round(val).toLocaleString('en-IN')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revenue Overview</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-lg font-bold">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Orders</p>
            <p className="text-lg font-bold">{orders.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Avg Order Value</p>
            <p className="text-lg font-bold">{formatCurrency(avgOrderValue)}</p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No paid orders found</TableCell></TableRow>
            ) : orders.map((order: any) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">
                  {order.order_number ? <CopyableText text={order.order_number} /> : '—'}
                </TableCell>
                <TableCell>
                  {order.customer?.company_name ? <CopyableText text={order.customer.company_name} /> : '—'}
                </TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(order.payment_amount || 0)}</TableCell>
                <TableCell>{format(new Date(order.created_at), 'dd MMM yyyy')}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/orders/${order.id}`);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); navigate('/order-analytics'); }}>
            <ExternalLink className="h-4 w-4 mr-2" /> View All Orders
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

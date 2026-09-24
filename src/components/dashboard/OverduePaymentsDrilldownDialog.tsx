import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { Search } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

export function OverduePaymentsDrilldownDialog({ open, onOpenChange }: Props) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['overdue-payments-drilldown'],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('sales_orders')
        .select('id, order_number, order_value, created_at, customer:customers(company_name)');

      const { data: payments } = await supabase
        .from('customer_payments')
        .select('sales_order_id, amount');

      const paymentsByOrder: Record<string, number> = {};
      (payments || []).forEach(p => {
        if (p.sales_order_id) {
          paymentsByOrder[p.sales_order_id] = (paymentsByOrder[p.sales_order_id] || 0) + p.amount;
        }
      });

      const now = new Date();
      return (orders || [])
        .map((o: any) => {
          const paid = paymentsByOrder[o.id] || 0;
          const outstanding = (o.order_value || 0) - paid;
          const termsDays = 30;
          const dueDate = new Date(o.created_at);
          dueDate.setDate(dueDate.getDate() + termsDays);
          const overdueDays = differenceInDays(now, dueDate);
          return {
            id: o.id,
            orderNumber: o.order_number,
            customer: o.customer?.company_name || 'N/A',
            outstanding,
            dueDate,
            overdueDays,
            date: o.created_at,
          };
        })
        .filter(o => o.outstanding > 0 && o.overdueDays > 0)
        .sort((a, b) => b.overdueDays - a.overdueDays);
    },
    enabled: open,
  });

  const filtered = (data || []).filter(o =>
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.customer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Overdue Payments — {filtered.length} orders</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by order or customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Overdue</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No overdue payments</TableCell></TableRow>
            ) : filtered.slice(0, 50).map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                <TableCell>{o.customer}</TableCell>
                <TableCell>{format(o.dueDate, 'dd MMM yyyy')}</TableCell>
                <TableCell>
                  <Badge variant={o.overdueDays > 60 ? 'destructive' : 'secondary'}>
                    {o.overdueDays} days
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium text-destructive">{formatCurrency(o.outstanding)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

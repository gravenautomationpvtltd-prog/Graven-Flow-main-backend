import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Search } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

export function ReceivablesDrilldownDialog({ open, onOpenChange }: Props) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['receivables-drilldown'],
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

      return (orders || [])
        .map((o: any) => ({
          id: o.id,
          orderNumber: o.order_number,
          customer: o.customer?.company_name || 'N/A',
          orderValue: o.order_value || 0,
          paid: paymentsByOrder[o.id] || 0,
          outstanding: Math.max(0, (o.order_value || 0) - (paymentsByOrder[o.id] || 0)),
          date: o.created_at,
        }))
        .filter(o => o.outstanding > 0)
        .sort((a, b) => b.outstanding - a.outstanding);
    },
    enabled: open,
  });

  const filtered = (data || []).filter(o =>
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.customer.toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = filtered.reduce((s, o) => s + o.outstanding, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Total Receivables — {formatCurrency(totalOutstanding)}</DialogTitle>
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
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Order Value</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No outstanding receivables</TableCell></TableRow>
            ) : filtered.slice(0, 50).map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                <TableCell>{o.customer}</TableCell>
                <TableCell>{format(new Date(o.date), 'dd MMM yyyy')}</TableCell>
                <TableCell className="text-right">{formatCurrency(o.orderValue)}</TableCell>
                <TableCell className="text-right text-success">{formatCurrency(o.paid)}</TableCell>
                <TableCell className="text-right font-medium text-destructive">{formatCurrency(o.outstanding)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length > 50 && <p className="text-sm text-muted-foreground text-center">Showing 50 of {filtered.length} records</p>}
      </DialogContent>
    </Dialog>
  );
}

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageCircle, Mail, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CreateRepeatEnquiryButton } from './CreateRepeatEnquiryButton';
import type { CstCustomer } from '@/hooks/useCstCustomers';

interface Props {
  customers: CstCustomer[];
  isLoading: boolean;
  emptyMessage?: string;
}

const formatINR = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(v));

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export function CstCustomerTable({ customers, isLoading, emptyMessage = 'No customers in this view' }: Props) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customers.length) {
    return (
      <div className="text-center py-16 text-muted-foreground border rounded-lg bg-muted/20">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead className="hidden md:table-cell">Location</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-center">Orders</TableHead>
            <TableHead>Last Order</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => {
            const days = c.days_since_last_activity ?? 0;
            const riskBadge =
              days >= 90 ? <Badge variant="destructive" className="ml-2">{days}d</Badge>
              : days >= 60 ? <Badge variant="secondary" className="ml-2">{days}d</Badge>
              : null;

            return (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/customers/${c.id}`)}>
                <TableCell>
                  <div className="font-medium">{c.company_name}</div>
                  {c.contact_person && <div className="text-xs text-muted-foreground">{c.contact_person}</div>}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                </TableCell>
                <TableCell className="text-right font-medium">{formatINR(c.total_revenue)}</TableCell>
                <TableCell className="text-center">{c.order_count}</TableCell>
                <TableCell className="text-sm">{formatDate(c.last_order_date)}</TableCell>
                <TableCell className="text-sm">
                  {formatDate(c.last_activity_date)}
                  {riskBadge}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {c.phone && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <a href={`tel:${c.phone}`}><Phone className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                    {c.phone && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <a
                          href={`https://wa.me/${c.phone.replace(/\D/g, '').replace(/^0+/, '').slice(-10).padStart(12, '91')}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                    {c.email && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <a href={`mailto:${c.email}`}><Mail className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                    <CreateRepeatEnquiryButton customerId={c.id} customerName={c.company_name} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

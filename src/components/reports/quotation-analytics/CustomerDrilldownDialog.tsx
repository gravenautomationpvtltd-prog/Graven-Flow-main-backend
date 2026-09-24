import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ExternalLink, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';

const fmt = (n: number) => formatCurrencyWithSymbol(n, 'INR');

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  dateRange: { from?: Date; to?: Date };
}

export function CustomerDrilldownDialog({ open, onOpenChange, customerId, customerName, dateRange }: Props) {
  const [search, setSearch] = useState('');

  const { data: quotations, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-drilldown', customerId, dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    enabled: open && !!customerId,
    queryFn: async () => {
      let q = supabase
        .from('quotations')
        .select('id, quotation_number, grand_total, status, is_converted, loss_reason, created_at, lead_id, created_by, profiles!quotations_created_by_fkey(full_name)')
        .eq('customer_id', customerId)
        .is('deleted_at', null)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });
      if (dateRange.from) q = q.gte('created_at', dateRange.from.toISOString());
      if (dateRange.to) q = q.lte('created_at', dateRange.to.toISOString());

      const { data, error } = await q.limit(500);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!quotations) return [];
    if (!search) return quotations;
    const s = search.toLowerCase();
    return quotations.filter(q => {
      const staff = (q.profiles as any)?.full_name || '';
      return staff.toLowerCase().includes(s) || q.quotation_number.toLowerCase().includes(s);
    });
  }, [quotations, search]);

  const stats = useMemo(() => {
    if (!quotations) return { total: 0, value: 0, converted: 0, rate: 0 };
    const total = quotations.length;
    const converted = quotations.filter(q => q.is_converted).length;
    const value = quotations.reduce((s, q) => s + (q.grand_total || 0), 0);
    return { total, value, converted, rate: total ? (converted / total) * 100 : 0 };
  }, [quotations]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'default';
      case 'accepted': return 'default';
      case 'draft': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{customerName} — Quotation History</DialogTitle>
          <DialogDescription>All quotations for this customer in the selected period</DialogDescription>
        </DialogHeader>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{fmt(stats.value)}</div>
            <div className="text-xs text-muted-foreground">Value</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{stats.converted}</div>
            <div className="text-xs text-muted-foreground">Converted</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold">{stats.rate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Conv Rate</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search staff or quotation..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : isError ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-destructive">Failed to load quotations</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quotation #</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Converted</TableHead>
                <TableHead>Loss Reason</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No quotations found</TableCell></TableRow>
              ) : filtered.map(q => (
                <TableRow
                  key={q.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => { if (q.lead_id) window.open(`/leads/${q.lead_id}`, '_blank'); }}
                >
                  <TableCell className="font-medium">{q.quotation_number}</TableCell>
                  <TableCell>{(q.profiles as any)?.full_name || '—'}</TableCell>
                  <TableCell>{fmt(q.grand_total || 0)}</TableCell>
                  <TableCell><Badge variant={statusColor(q.status)}>{q.status}</Badge></TableCell>
                  <TableCell>{q.is_converted ? '✓' : '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{q.loss_reason || '—'}</TableCell>
                  <TableCell className="text-xs">{new Date(q.created_at).toLocaleDateString('en-IN')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/customers/${customerId}`, '_blank')}
          >
            <User className="h-4 w-4 mr-1" /> View Customer Details
          </Button>
          <div className="text-xs text-muted-foreground">
            {filtered.length} of {quotations?.length || 0} quotations • Click a row to view lead <ExternalLink className="inline h-3 w-3" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

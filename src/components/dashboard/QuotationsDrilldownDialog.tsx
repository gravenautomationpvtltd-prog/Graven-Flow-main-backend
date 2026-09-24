import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: { from?: Date; to?: Date };
  assignedTo?: string;
}

const statusColors: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  revised: 'bg-purple-100 text-purple-800',
};

export function QuotationsDrilldownDialog({ open, onOpenChange, dateRange, assignedTo }: Props) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['drilldown-quotations', dateRange.from, dateRange.to, statusFilter, assignedTo ?? null],
    queryFn: async () => {
      let query = supabase
        .from('quotations')
        .select('*, customer:customers(company_name), lead_id')
        .is('deleted_at', null)
        .not('status', 'in', '("won","lost","draft")')
        .order('created_at', { ascending: false })
        .limit(20);

      if (dateRange.from) query = query.gte('created_at', dateRange.from.toISOString());
      if (dateRange.to) query = query.lte('created_at', dateRange.to.toISOString());
      if (assignedTo) query = query.eq('created_by', assignedTo);
      if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const totalValue = quotations.reduce((sum: number, q: any) => sum + (q.grand_total || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pending Quotations</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-lg font-bold">₹{Math.round(totalValue).toLocaleString('en-IN')}</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="revised">Revised</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quotation #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : quotations.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No quotations found</TableCell></TableRow>
            ) : quotations.map((q: any) => (
              <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { if (q.lead_id) { onOpenChange(false); navigate(`/leads/${q.lead_id}`); } }}>
                <TableCell className="font-medium">{q.quotation_number || '—'}</TableCell>
                <TableCell>{q.customer?.company_name || '—'}</TableCell>
                <TableCell className="text-right font-medium">₹{Math.round(q.grand_total || 0).toLocaleString('en-IN')}</TableCell>
                <TableCell><Badge className={statusColors[q.status] || ''} variant="secondary">{q.status}</Badge></TableCell>
                <TableCell>{format(new Date(q.created_at), 'dd MMM yyyy')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); navigate('/leads'); }}>
            <ExternalLink className="h-4 w-4 mr-2" /> View All Leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: { from?: Date; to?: Date };
  assignedTo?: string;
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-purple-100 text-purple-800',
  proposal: 'bg-indigo-100 text-indigo-800',
  negotiation: 'bg-orange-100 text-orange-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

export function LeadsDrilldownDialog({ open, onOpenChange, dateRange, assignedTo }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['drilldown-leads', dateRange.from, dateRange.to, search, statusFilter, assignedTo ?? null],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('*, customer:customers(company_name, contact_person)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (dateRange.from) query = query.gte('created_at', dateRange.from.toISOString());
      if (dateRange.to) query = query.lte('created_at', dateRange.to.toISOString());
      if (assignedTo) query = query.eq('assigned_to', assignedTo);
      if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter as any);
      if (search) query = query.or(`title.ilike.%${search}%,customer_query.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leads Overview</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="negotiation">Negotiation</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : leads.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No leads found</TableCell></TableRow>
            ) : leads.map((lead: any) => (
              <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { onOpenChange(false); navigate(`/leads/${lead.id}`); }}>
                <TableCell className="font-medium">{lead.title || 'Untitled'}</TableCell>
                <TableCell>{lead.customer?.company_name || '—'}</TableCell>
                <TableCell><Badge className={statusColors[lead.status] || ''} variant="secondary">{lead.status}</Badge></TableCell>
                <TableCell className="capitalize">{lead.source?.replace(/_/g, ' ') || '—'}</TableCell>
                <TableCell>{format(new Date(lead.created_at), 'dd MMM yyyy')}</TableCell>
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

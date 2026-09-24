import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: { from?: Date; to?: Date };
}

const statusLabels: Record<string, string> = {
  pending_verification: 'Verification',
  pending_authorization: 'Authorization',
  pending_approval: 'Approval',
};

const statusColors: Record<string, string> = {
  pending_verification: 'bg-amber-100 text-amber-800',
  pending_authorization: 'bg-blue-100 text-blue-800',
  pending_approval: 'bg-green-100 text-green-800',
};

export function PendingPOsDrilldownDialog({ open, onOpenChange, dateRange }: Props) {
  const navigate = useNavigate();

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ['drilldown-pending-pos', dateRange.from, dateRange.to],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select('*, supplier:suppliers(company_name)')
        .in('status', ['pending_verification', 'pending_authorization', 'pending_approval'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (dateRange.from) query = query.gte('created_at', dateRange.from.toISOString());
      if (dateRange.to) query = query.lte('created_at', dateRange.to.toISOString());

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const totalValue = pos.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pending Purchase Orders</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Pending POs</p>
            <p className="text-lg font-bold">{pos.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-lg font-bold">₹{Math.round(totalValue).toLocaleString('en-IN')}</p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : pos.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No pending POs found</TableCell></TableRow>
            ) : pos.map((po: any) => (
              <TableRow key={po.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { onOpenChange(false); navigate(`/procurement/po/${po.id}`); }}>
                <TableCell className="font-medium">{po.po_number || '—'}</TableCell>
                <TableCell>{po.supplier?.company_name || '—'}</TableCell>
                <TableCell className="text-right font-medium">₹{Math.round(po.total_amount || 0).toLocaleString('en-IN')}</TableCell>
                <TableCell><Badge className={statusColors[po.status] || ''} variant="secondary">{statusLabels[po.status] || po.status}</Badge></TableCell>
                <TableCell>{format(new Date(po.created_at), 'dd MMM yyyy')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); navigate('/procurement'); }}>
            <ExternalLink className="h-4 w-4 mr-2" /> View All POs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

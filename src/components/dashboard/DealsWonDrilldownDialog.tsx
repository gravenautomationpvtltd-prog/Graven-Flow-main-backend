import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { CopyableText } from '@/components/shared/CopyableText';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: { from?: Date; to?: Date };
  assignedTo?: string;
}

export function DealsWonDrilldownDialog({ open, onOpenChange, dateRange, assignedTo }: Props) {
  const navigate = useNavigate();

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['drilldown-deals-won', dateRange.from?.toISOString(), dateRange.to?.toISOString(), assignedTo ?? null],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('*, customer:customers(company_name)')
        .eq('status', 'won')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (dateRange.from) query = query.or(`won_at.gte.${dateRange.from.toISOString()},and(won_at.is.null,created_at.gte.${dateRange.from.toISOString()})`);
      if (dateRange.to) query = query.or(`won_at.lte.${dateRange.to.toISOString()},and(won_at.is.null,created_at.lte.${dateRange.to.toISOString()})`);
      if (assignedTo) query = query.eq('assigned_to', assignedTo);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const totalValue = deals.reduce((sum: number, d: any) => sum + (d.estimated_value || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deals Won</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Won Deals</p>
            <p className="text-lg font-bold">{deals.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-lg font-bold">₹{Math.round(totalValue).toLocaleString('en-IN')}</p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Won Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : deals.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No won deals found</TableCell></TableRow>
            ) : deals.map((deal: any) => (
              <TableRow key={deal.id} className="hover:bg-muted/40 transition-colors">
                <TableCell className="font-medium">
                  <CopyableText
                    text={deal.title || 'Untitled'}
                    label="lead title"
                    onClickText={!deal.customer?.company_name ? () => { onOpenChange(false); navigate(`/leads/${deal.id}`); } : undefined}
                    textClassName="font-medium"
                  />
                </TableCell>
                <TableCell>
                  {deal.customer?.company_name ? (
                    <CopyableText
                      text={deal.customer.company_name}
                      label="company name"
                      onClickText={() => { onOpenChange(false); navigate(`/leads/${deal.id}`); }}
                      textClassName="font-medium text-foreground"
                    />
                  ) : '—'}
                </TableCell>
                <TableCell className="text-right font-medium">₹{Math.round(deal.estimated_value || 0).toLocaleString('en-IN')}</TableCell>
                <TableCell>{deal.won_at ? format(new Date(deal.won_at), 'dd MMM yyyy') : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); navigate('/leads?status=won'); }}>
            <ExternalLink className="h-4 w-4 mr-2" /> View All Won Deals
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

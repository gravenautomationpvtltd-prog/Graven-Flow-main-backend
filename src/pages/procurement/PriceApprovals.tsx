import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useIsBulkPriceApprover } from '@/hooks/useProcurementApprovers';

export default function PriceApprovals() {
  const isApprover = useIsBulkPriceApprover();

  const { data: batches, isLoading } = useQuery({
    queryKey: ['price-submission-batches'],
    enabled: isApprover,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_submission_batches')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((b: any) => b.submitted_by).filter(Boolean)));
      let profiles: Record<string, any> = {};
      if (ids.length) {
        const { data: ps } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
        (ps || []).forEach((p: any) => { profiles[p.id] = p; });
      }
      return (data || []).map((b: any) => ({ ...b, submitter: profiles[b.submitted_by] }));
    },
  });

  if (!isApprover) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Bulk Price Approvals</h1>
        <p className="text-muted-foreground">
          Review RMB price dumps from procurement. Fill the per-line landed-cost calculator, approve, and the products auto-update.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : !batches?.length ? (
            <p className="text-muted-foreground text-sm">No submissions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell>{format(new Date(b.submitted_at), 'dd MMM yyyy, HH:mm')}</TableCell>
                    <TableCell>{b.supplier_name || '—'}</TableCell>
                    <TableCell>{b.submitter?.full_name || b.submitter?.email || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={b.status === 'approved' ? 'default' : b.status === 'rejected' ? 'destructive' : 'secondary'}>
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/procurement/price-approvals/${b.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

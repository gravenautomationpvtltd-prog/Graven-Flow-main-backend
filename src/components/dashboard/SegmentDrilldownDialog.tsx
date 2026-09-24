import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ExternalLink, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { getSegmentConfig } from '@/lib/segment-config';
import type { SegmentMetric } from '@/hooks/useSegmentAnalytics';
import type { DateRange } from '@/hooks/useDashboardAnalytics';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: string;
  segmentLabel: string;
  metric: SegmentMetric;
  metricLabel: string;
  dateRange?: DateRange;
  userId?: string;
  isScoped?: boolean;
}

const METRIC_DESCRIPTIONS: Record<SegmentMetric, string> = {
  customers: 'All customers in this segment',
  leads: 'Customers with leads in this segment',
  enquiries: 'Customers with enquiry items in this segment',
  quotations: 'Customers with quotations in this segment',
  conversions: 'Customers with won leads in this segment',
  revenue: 'Customers with sales orders in this segment',
  all_qualifiers: 'Customers with leads, enquiries, quotations & orders',
};

export function SegmentDrilldownDialog({
  open,
  onOpenChange,
  segment,
  segmentLabel,
  metric,
  metricLabel,
  dateRange,
  userId,
  isScoped,
}: Props) {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['segment-drilldown', segment, metric, dateRange?.from, dateRange?.to, userId, isScoped, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_segment_drilldown_customers', {
        p_segment: segment,
        p_metric: metric,
        p_from: dateRange?.from?.toISOString() ?? null,
        p_to: dateRange?.to?.toISOString() ?? null,
        p_user_id: (isScoped && userId) ? userId : null,
        p_is_scoped: !!isScoped,
        p_search: search || null,
        p_limit: 50,
        p_offset: 0,
      });
      if (error) {
        console.error('[SegmentDrilldown] RPC error:', error);
        throw error;
      }
      const result = data as { rows: any[]; total: number } | null;
      return result ?? { rows: [], total: 0 };
    },
    enabled: open && !!segment,
  });

  const customers = data?.rows ?? [];
  const totalCount = data?.total ?? 0;
  const segConfig = getSegmentConfig(segment);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg">
              {segmentLabel} Segment — {metricLabel}
            </DialogTitle>
            <Badge className={segConfig.badgeClass}>{segmentLabel}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {METRIC_DESCRIPTIONS[metric]} • {totalCount} customer{totalCount !== 1 ? 's' : ''} found
          </p>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, contact, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-destructive">
                  <div className="flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Couldn't load customers, please retry
                  </div>
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No customers found</TableCell>
              </TableRow>
            ) : (
              customers.map((c: any) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => window.open(`/customers/${c.id}`, '_blank')}
                >
                  <TableCell className="font-medium">{c.company_name}</TableCell>
                  <TableCell>{c.contact_person || '—'}</TableCell>
                  <TableCell>{c.phone || '—'}</TableCell>
                  <TableCell>{c.assigned_sales_name || '—'}</TableCell>
                  <TableCell>{format(new Date(c.created_at), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); window.open(`/customers?segment=${segment}`, '_blank'); }}>
            <ExternalLink className="h-4 w-4 mr-2" /> View All {segmentLabel} Customers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

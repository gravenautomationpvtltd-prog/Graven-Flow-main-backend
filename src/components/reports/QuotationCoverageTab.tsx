import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { UNQUOTED_REASONS, setUnquotedReason, useQuotationCoverage, type CoverageGroup } from '@/hooks/useQuotationCoverage';

interface Props {
  dateFrom?: string | Date;
  dateTo?: string | Date;
}

const iso = (d?: string | Date) => (d instanceof Date ? d.toISOString() : d);

export function QuotationCoverageTab({ dateFrom, dateTo }: Props) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuotationCoverage({ from: iso(dateFrom), to: iso(dateTo) });

  if (isLoading || !data) {
    return <div className="space-y-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const onTarget = data.coveragePct >= 90;

  const handleReason = async (leadId: string, reason: string) => {
    try {
      await setUnquotedReason(leadId, reason);
      toast.success('Reason saved');
      queryClient.invalidateQueries({ queryKey: ['quotation-coverage'] });
    } catch (e) {
      toast.error((e as Error).message || 'Could not save the reason');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total leads" value={data.totalLeads} />
        <Kpi label="Quoted leads" value={data.quotedLeads} />
        <Kpi label="Unquoted leads" value={data.unquotedLeads} />
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Quotation coverage</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{data.coveragePct}%</span>
              <Badge variant={onTarget ? 'default' : 'secondary'}>{onTarget ? 'On target' : 'Target 90%'}</Badge>
            </div>
            <Progress value={Math.min(100, data.coveragePct)} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Why leads were not quoted</CardTitle></CardHeader>
        <CardContent>
          {data.reasonBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every lead in this period has a quotation.</p>
          ) : (
            <div className="space-y-2">
              {data.reasonBreakdown.map((r) => (
                <div key={r.reason} className="flex items-center gap-3 text-sm">
                  <span className="w-64 shrink-0">{r.reason}</span>
                  <Progress value={r.pct} className="flex-1" />
                  <span className="w-24 text-right text-muted-foreground">{r.pct}% ({r.count})</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupCard title="Coverage by person" groups={data.byOwner} />
        <GroupCard title="Coverage by department" groups={data.byDepartment} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Unquoted leads — capture a reason</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="w-[260px]">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.unquotedList.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">{l.title || '—'}</TableCell>
                    <TableCell className="text-sm">{l.company_name || '—'}</TableCell>
                    <TableCell className="text-sm">{new Date(l.created_at).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>
                      <Select value={l.unquoted_reason ?? undefined} onValueChange={(v) => handleReason(l.id, v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {UNQUOTED_REASONS.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {data.unquotedList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground text-center py-6">
                      No unquoted leads in this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GroupCard({ title, groups }: { title: string; groups: CoverageGroup[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leads in this period.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Quoted</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell className="text-sm">{g.label}</TableCell>
                    <TableCell className="text-right text-sm">{g.total}</TableCell>
                    <TableCell className="text-right text-sm">{g.quoted}</TableCell>
                    <TableCell className="text-right text-sm">
                      <Badge variant={g.coveragePct >= 90 ? 'default' : 'secondary'}>{g.coveragePct}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value.toLocaleString('en-IN')}</p>
      </CardContent>
    </Card>
  );
}

import { Link } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, ExternalLink } from 'lucide-react';
import {
  useVarianceDrilldown,
  DRILLABLE_METRICS,
  type VarianceBreakdownRow,
} from '@/hooks/useVarianceDrilldown';
import { BENCHMARK_METRICS } from '@/hooks/useBenchmarks';

const inr = (n: number | null | undefined) =>
  n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`;
const hrs = (h: number | null | undefined) =>
  h == null ? '—' : h < 1 ? `${Math.round(h * 60)}m` : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;

const fmtValue = (metric: string, v: number) => {
  const unit = BENCHMARK_METRICS[metric]?.unit ?? 'percent';
  if (unit === 'percent') return `${v.toFixed(1)}%`;
  if (unit === 'hours') return hrs(v);
  return Math.round(v).toLocaleString('en-IN');
};

function BreakdownGroup({
  title,
  metric,
  rows,
}: {
  title: string;
  metric: string;
  rows: VarianceBreakdownRow[];
}) {
  if (rows.length === 0) return null;
  const worst = Math.max(...rows.map((r) => r.offenders), 1);
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.dim + r.label} className="rounded-md border p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium capitalize truncate">{r.label.replace(/_/g, ' ')}</span>
              <span className="text-xs tabular-nums font-semibold">{fmtValue(metric, r.value)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-destructive/70"
                style={{ width: `${(r.offenders / worst) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {r.offenders.toLocaleString('en-IN')} driving the gap · {r.volume.toLocaleString('en-IN')} raised
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VarianceDrilldown({
  metric,
  onOpenChange,
  from,
  to,
  officeId,
  department,
  regionLabel,
  departmentLabel,
  targetValue,
  actualValue,
}: {
  metric: string | null;
  onOpenChange: (v: boolean) => void;
  from: string;
  to: string;
  officeId: string | null;
  department: string | null;
  regionLabel: string;
  departmentLabel: string;
  targetValue?: number | null;
  actualValue?: number | null;
}) {
  const { data, isLoading } = useVarianceDrilldown(metric, from, to, officeId, department);
  const meta = metric ? DRILLABLE_METRICS[metric] : undefined;
  const label = metric ? BENCHMARK_METRICS[metric]?.label ?? meta?.title ?? metric : '';

  const exportCsv = () => {
    if (!data) return;
    const head = [
      'Item', 'Branch', 'Department', 'Owner', 'Raised', 'Resolved', 'TAT deadline',
      'Status', 'Target rate', 'Resolved price', 'Gap %', 'Hours', 'Age (days)', 'Sales outcome',
    ];
    const body = data.rows.map((r) => [
      r.item_label, r.office_name ?? '', r.department, r.owner_name,
      new Date(r.requested_at).toLocaleDateString('en-IN'),
      r.resolved_at ? new Date(r.resolved_at).toLocaleDateString('en-IN') : '',
      r.tat_deadline ? new Date(r.tat_deadline).toLocaleString('en-IN') : '',
      r.status, r.target_rate ?? '', r.resolved_price ?? '',
      r.gap_pct ?? '', r.hours_taken ?? '', r.age_days ?? '', r.sales_outcome ?? '',
    ]);
    const csv = [head, ...body].map((l) => l.map((c) => `"${String(c ?? '')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `variance-${metric}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={!!metric} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base flex items-center gap-2">
            {meta?.title ?? 'Variance detail'}
            <Badge variant="outline" className="font-normal">{regionLabel}</Badge>
            <Badge variant="outline" className="font-normal capitalize">{departmentLabel}</Badge>
          </SheetTitle>
          <SheetDescription>
            {label}
            {actualValue != null && metric && (
              <> · actual <span className="font-medium text-foreground">{fmtValue(metric, actualValue)}</span></>
            )}
            {targetValue != null && metric && <> vs target {fmtValue(metric, targetValue)}</>}
            {data && (
              <> · {data.total_offenders.toLocaleString('en-IN')} {meta?.offenderLabel ?? 'requests'}</>
            )}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !data ? (
          <div className="space-y-3 pt-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <div className="space-y-3 pt-1">
              <BreakdownGroup
                title="By branch"
                metric={data.metric}
                rows={data.breakdown.filter((b) => b.dim === 'region')}
              />
              <BreakdownGroup
                title="By department"
                metric={data.metric}
                rows={data.breakdown.filter((b) => b.dim === 'department')}
              />
              <BreakdownGroup
                title="By owner"
                metric={data.metric}
                rows={data.breakdown.filter((b) => b.dim === 'owner').slice(0, 8)}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Showing the {Math.min(data.rows.length, 200)} most severe of{' '}
                {data.total_offenders.toLocaleString('en-IN')}
              </p>
              <Button variant="outline" size="sm" className="h-8" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                CSV
              </Button>
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Branch / owner</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Priced</TableHead>
                    <TableHead className="text-right">Gap</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                    <TableHead className="w-[52px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs max-w-[230px] break-words">
                        {r.item_label}
                        {r.sales_outcome && (
                          <Badge variant="secondary" className="ml-1.5 text-[10px] capitalize">
                            {r.sales_outcome.replace('_', ' ')}
                          </Badge>
                        )}
                        <span className="block text-[11px] text-muted-foreground capitalize">
                          {r.status.replace('_', ' ')} ·{' '}
                          {new Date(r.requested_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.office_name ?? '—'}
                        <span className="block text-[11px] text-muted-foreground">{r.owner_name}</span>
                      </TableCell>
                      <TableCell className="text-xs text-right">{inr(r.target_rate)}</TableCell>
                      <TableCell className="text-xs text-right">{inr(r.resolved_price)}</TableCell>
                      <TableCell
                        className={`text-xs text-right font-semibold ${
                          (r.gap_pct ?? 0) > 0 ? 'text-destructive' : 'text-emerald-600'
                        }`}
                      >
                        {r.gap_pct == null ? '—' : `${r.gap_pct.toFixed(1)}%`}
                      </TableCell>
                      <TableCell className="text-xs text-right whitespace-nowrap">
                        {r.resolved_at ? hrs(r.hours_taken) : `${(r.age_days ?? 0).toFixed(0)}d open`}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                          <Link to={`/procurement?request=${r.id}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                        Nothing is dragging this metric down in the selected period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Gauge, Settings2 } from 'lucide-react';
import {
  BENCHMARK_METRICS,
  benchmarkStatus,
  resolveBenchmark,
  type Benchmark,
} from '@/hooks/useBenchmarks';

export interface BenchmarkActuals {
  coverage_pct: number;
  tat_compliance_pct: number;
  target_match_pct: number | null;
  price_gap_pct: number | null;
  avg_resolution_hours: number;
  no_price_rate_pct: number;
  multi_quote_pct: number | null;
  backlog_open: number;
}

const fmt = (metric: string, v: number) => {
  const unit = BENCHMARK_METRICS[metric]?.unit;
  if (unit === 'percent') return `${v.toFixed(1)}%`;
  if (unit === 'hours') return v < 24 ? `${v.toFixed(1)}h` : `${(v / 24).toFixed(1)}d`;
  return Math.round(v).toLocaleString('en-IN');
};

const tone = {
  on_track: { cls: 'text-emerald-600', badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', label: 'On track' },
  watch: { cls: 'text-amber-600', badge: 'bg-amber-500/10 text-amber-600 border-amber-500/30', label: 'Watch' },
  off_track: { cls: 'text-destructive', badge: 'bg-destructive/10 text-destructive border-destructive/30', label: 'Off track' },
};

export function BenchmarkVariance({
  benchmarks,
  actuals,
  officeId,
  regionLabel,
  canEdit,
  onSetup,
  onDrill,
}: {
  benchmarks: Benchmark[];
  actuals: BenchmarkActuals;
  officeId: string | null;
  regionLabel: string;
  canEdit?: boolean;
  onSetup?: () => void;
  onDrill?: (metric: string, actual: number, target: number) => void;
}) {
  const rows = (Object.keys(BENCHMARK_METRICS) as (keyof BenchmarkActuals & string)[])
    .map((metric) => {
      const b = resolveBenchmark(benchmarks, metric, officeId);
      const actual = actuals[metric as keyof BenchmarkActuals];
      if (!b || actual === null || actual === undefined) return null;
      const value = Number(actual);
      const status = benchmarkStatus(b, value);
      const variance = value - Number(b.target_value);
      const variancePct = b.target_value ? (variance / Math.abs(Number(b.target_value))) * 100 : 0;
      const attainment =
        b.direction === 'higher_better'
          ? (value / Number(b.target_value)) * 100
          : (Number(b.target_value) / (value || Number(b.target_value))) * 100;
      return { metric, b, value, status, variance, variancePct, attainment };
    })
    .filter(Boolean) as Array<{
      metric: string; b: Benchmark; value: number; status: keyof typeof tone;
      variance: number; variancePct: number; attainment: number;
    }>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          Benchmark variance
          <Badge variant="outline" className="font-normal">{regionLabel}</Badge>
        </CardTitle>
        {canEdit && (
          <Button variant="outline" size="sm" className="h-8" onClick={onSetup}>
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Set benchmarks
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No benchmarks defined for this scope yet.
            {canEdit && ' Use “Set benchmarks” to define targets per department and region.'}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <div
                key={r.metric}
                role={onDrill ? 'button' : undefined}
                tabIndex={onDrill ? 0 : undefined}
                onClick={() => onDrill?.(r.metric, r.value, Number(r.b.target_value))}
                onKeyDown={(e) =>
                  onDrill && (e.key === 'Enter' || e.key === ' ')
                    ? (e.preventDefault(), onDrill(r.metric, r.value, Number(r.b.target_value)))
                    : undefined
                }
                className={`rounded-lg border p-3 space-y-1.5 ${
                  onDrill ? 'cursor-pointer transition-colors hover:border-primary/60 hover:bg-muted/40' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground leading-tight">
                    {BENCHMARK_METRICS[r.metric].label}
                  </p>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${tone[r.status].badge}`}>
                    {tone[r.status].label}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold tabular-nums">{fmt(r.metric, r.value)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    target {fmt(r.metric, Number(r.b.target_value))}
                  </span>
                </div>
                <p className={`text-[11px] font-medium ${tone[r.status].cls}`}>
                  {r.variance > 0 ? '+' : ''}
                  {fmt(r.metric, r.variance)} ({r.variancePct > 0 ? '+' : ''}
                  {r.variancePct.toFixed(0)}%) vs benchmark
                  {r.b.office_id ? ' · region' : ' · company-wide'}
                </p>
                <Progress value={Math.max(0, Math.min(100, r.attainment))} className="h-1.5" />
                {onDrill && (
                  <p className="text-[10px] text-muted-foreground">Click to see what drives this</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

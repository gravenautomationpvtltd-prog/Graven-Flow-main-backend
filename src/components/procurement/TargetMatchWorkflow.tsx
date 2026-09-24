import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Clock, TrendingDown, CheckCircle2 } from 'lucide-react';
import type { TargetMatchScorecard } from '@/hooks/useTargetMatchScorecard';

const pctText = (v: number) => `${v.toFixed(1)}%`;
const hrsText = (h: number) => (h < 1 ? `${Math.round(h * 60)}m` : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`);

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  progress,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  tone?: 'good' | 'warn';
  progress?: number;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) =>
        onClick && (e.key === 'Enter' || e.key === ' ') ? (e.preventDefault(), onClick()) : undefined
      }
      className={`rounded-lg border p-3 space-y-1.5 ${
        onClick ? 'cursor-pointer transition-colors hover:border-primary/60 hover:bg-muted/40' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon
          className={`h-4 w-4 ${
            tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-destructive' : 'text-muted-foreground'
          }`}
        />
      </div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      {progress !== undefined && (
        <Progress value={Math.max(0, Math.min(100, progress))} className="h-1.5" />
      )}
    </div>
  );
}

export function TargetMatchWorkflow({
  data,
  isLoading,
  regionLabel,
  departmentLabel,
  onDrill,
}: {
  data?: TargetMatchScorecard;
  isLoading?: boolean;
  regionLabel: string;
  departmentLabel: string;
  onDrill?: (metric: string, actual: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Target-matched workflow
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="font-normal">{regionLabel}</Badge>
          <Badge variant="outline" className="font-normal capitalize">{departmentLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Target match rate"
                value={data.target_requests > 0 ? pctText(data.target_match_pct) : '—'}
                sub={`${data.target_matched} of ${data.target_requests} priced with a target`}
                icon={Target}
                tone={data.target_match_pct >= 60 ? 'good' : 'warn'}
                progress={data.target_match_pct}
                onClick={() => onDrill?.('target_match_pct', data.target_match_pct)}
              />
              <Stat
                label="TAT compliance"
                value={pctText(data.tat_compliance_pct)}
                sub={`${data.tat_met} on time · ${data.tat_missed} late · matched in ${hrsText(
                  data.matched_avg_resolution_hours,
                )}`}
                icon={Clock}
                tone={data.tat_compliance_pct >= 80 ? 'good' : 'warn'}
                progress={data.tat_compliance_pct}
                onClick={() => onDrill?.('tat_compliance_pct', data.tat_compliance_pct)}
              />
              <Stat
                label="Price-gap variance"
                value={data.target_requests > 0 ? pctText(data.price_gap_pct) : '—'}
                sub={`median ${pctText(data.price_gap_median_pct)} · P90 ${pctText(
                  data.price_gap_p90_pct,
                )} · worst ${pctText(data.price_gap_worst_pct)}`}
                icon={TrendingDown}
                tone={data.price_gap_pct <= 0 ? 'good' : 'warn'}
                onClick={() => onDrill?.('price_gap_pct', data.price_gap_pct)}
              />
              <Stat
                label="Win rate on matched prices"
                value={data.outcome_won + data.outcome_lost > 0 ? pctText(data.win_rate_pct) : '—'}
                sub={`${data.outcomes_recorded} outcomes recorded · ${data.matched_pending_outcome} awaiting sales`}
                icon={CheckCircle2}
                tone={data.win_rate_pct >= 40 ? 'good' : 'warn'}
                progress={data.win_rate_pct}
                onClick={() => onDrill?.('win_rate_pct', data.win_rate_pct)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Quoted', value: data.outcome_quoted },
                { label: 'Won', value: data.outcome_won },
                { label: 'Lost', value: data.outcome_lost },
                { label: 'On hold', value: data.outcome_on_hold },
              ].map((o) => (
                <div key={o.label} className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{o.label}</p>
                  <p className="text-lg font-semibold tabular-nums">{o.value.toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>

            {(data.outcome_won > 0 || data.outcome_lost > 0) && (
              <p className="text-xs text-muted-foreground">
                Won deals sat on average <span className="font-medium">{pctText(data.won_avg_gap_pct)}</span> from the
                asked target, lost deals <span className="font-medium">{pctText(data.lost_avg_gap_pct)}</span> — the
                gap between the two is the price headroom procurement needs to close.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

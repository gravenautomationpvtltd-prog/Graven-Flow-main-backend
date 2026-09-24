import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Inbox, CheckCircle2, XCircle, Timer, TrendingUp, Users } from 'lucide-react';
import { useLqtStats, type LqtTab, type LqtRange } from '@/hooks/useLqtLeads';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Props {
  onSelectTab?: (tab: LqtTab) => void;
  range?: LqtRange;
}

export function LqtStatsHeader({ onSelectTab, range }: Props) {
  const { data, isLoading } = useLqtStats(range);
  const rangeLabel = data?.rangeLabel ?? 'in range';

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  // Tone helpers
  const avgTone =
    data.avgQualMinutes === null
      ? { tone: 'text-muted-foreground', bg: 'bg-muted' }
      : data.avgQualMinutes < 30
      ? { tone: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' }
      : data.avgQualMinutes <= 60
      ? { tone: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' }
      : { tone: 'text-destructive', bg: 'bg-destructive/10' };

  const discardTone =
    data.discardRatePct < 10
      ? { tone: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' }
      : data.discardRatePct <= 25
      ? { tone: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' }
      : { tone: 'text-destructive', bg: 'bg-destructive/10' };

  const top = data.team[0];
  const bottom = data.team.length > 1 ? data.team[data.team.length - 1] : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {/* Card 1 — Pending Validation */}
      <ClickableCard onClick={() => onSelectTab?.('pending')}>
        <CardBody
          icon={Inbox}
          tone="text-amber-600"
          bg="bg-amber-100 dark:bg-amber-900/30"
          title="Pending Validation"
          value={data.pending.toString()}
          line1={data.oldestPendingLabel ? `Oldest: ${data.oldestPendingLabel}` : 'All caught up'}
          line2={`Priority: ${data.priorityPending}`}
        />
      </ClickableCard>

      {/* Card 2 — Qualified in range */}
      <ClickableCard onClick={() => onSelectTab?.('qualified')}>
        <CardBody
          icon={CheckCircle2}
          tone="text-green-600"
          bg="bg-green-100 dark:bg-green-900/30"
          title={`Qualified (${rangeLabel})`}
          value={data.qualifiedToday.toString()}
          line1={`SPT: ${data.sptToday} · TST: ${data.tstToday}`}
          line2="Validated and routed"
        />
      </ClickableCard>

      {/* Card 3 — Discard Rate */}
      <ClickableCard onClick={() => onSelectTab?.('discarded')}>
        <CardBody
          icon={XCircle}
          tone={discardTone.tone}
          bg={discardTone.bg}
          title={`Discard Rate (${rangeLabel})`}
          value={`${data.discardRatePct}%`}
          line1={`Junk: ${data.junkToday} · Duplicate: ${data.duplicateToday}`}
          line2={`Discarded: ${data.discardedToday}`}
        />
      </ClickableCard>

      {/* Card 4 — Avg Qualification Time (popover with oldest pending) */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="text-left">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <CardBody
                  icon={Timer}
                  tone={avgTone.tone}
                  bg={avgTone.bg}
                  title="Avg Qualification Time"
                  value={data.avgQualMinutes !== null ? `${data.avgQualMinutes}m` : '—'}
                  line1="Target: < 30 min"
                  line2="Receipt → Qualification"
                  noWrap
                />
              </CardContent>
            </Card>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <p className="font-semibold text-sm mb-2">Oldest pending leads</p>
          {data.oldestPendingList.length === 0 ? (
            <p className="text-xs text-muted-foreground">No pending leads.</p>
          ) : (
            <ul className="space-y-2">
              {data.oldestPendingList.map((l) => (
                <li key={l.id} className="text-xs flex justify-between gap-2">
                  <span className="truncate">
                    <span className="font-medium">{l.title}</span>
                    {l.customer_name && (
                      <span className="text-muted-foreground"> — {l.customer_name}</span>
                    )}
                  </span>
                  <span className="text-amber-600 font-medium shrink-0">{l.hoursWaiting}h</span>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      {/* Card 5 — Lead Acceptance */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="text-left">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <CardBody
                  icon={TrendingUp}
                  tone="text-purple-600"
                  bg="bg-purple-100 dark:bg-purple-900/30"
                  title="Lead Acceptance"
                  value={`${data.acceptance.overall}%`}
                  line1={`SPT: ${data.acceptance.spt}% · TST: ${data.acceptance.tst}%`}
                  line2={`Accepted by downstream (${rangeLabel})`}
                  noWrap
                />
              </CardContent>
            </Card>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <p className="font-semibold text-sm mb-2">Acceptance breakdown ({rangeLabel})</p>
          <div className="space-y-2 text-xs">
            <Row label="Overall" value={`${data.acceptance.overall}%`} />
            <Row
              label="SPT"
              value={`${data.acceptance.spt}% of ${data.acceptance.sptTotal}`}
            />
            <Row
              label="TST"
              value={`${data.acceptance.tst}% of ${data.acceptance.tstTotal}`}
            />
            <p className="text-muted-foreground pt-2 border-t border-border">
              "Accepted" = downstream team logged enquiry items or moved status past <em>new</em>.
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* Card 6 — Team Performance */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="text-left">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <CardBody
                  icon={Users}
                  tone="text-rose-600"
                  bg="bg-rose-100 dark:bg-rose-900/30"
                  title="Team Performance"
                  value={top ? `${top.qualified}` : '—'}
                  line1={top ? `Top: ${top.name}` : `No actions ${rangeLabel}`}
                  line2={
                    bottom && bottom.user_id !== top?.user_id
                      ? `Lowest: ${bottom.name} – ${bottom.qualified}`
                      : top ? 'Single agent' : '—'
                  }
                  noWrap
                />
              </CardContent>
            </Card>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="end">
          <p className="font-semibold text-sm mb-2">LQT agents — {rangeLabel}</p>
          {data.team.length === 0 ? (
            <p className="text-xs text-muted-foreground">No qualifications {rangeLabel}.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="py-1 font-medium">Agent</th>
                  <th className="py-1 font-medium text-right">Qual</th>
                  <th className="py-1 font-medium text-right">Disc</th>
                  <th className="py-1 font-medium text-right">Avg</th>
                </tr>
              </thead>
              <tbody>
                {data.team.map((t) => (
                  <tr key={t.user_id} className="border-t border-border">
                    <td className="py-1.5 truncate">{t.name}</td>
                    <td className="py-1.5 text-right text-green-600 font-medium">{t.qualified}</td>
                    <td className="py-1.5 text-right text-destructive">{t.discarded}</td>
                    <td className="py-1.5 text-right">
                      {t.avgMinutes !== null ? `${t.avgMinutes}m` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ClickableCard({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="text-left">
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">{children}</CardContent>
      </Card>
    </button>
  );
}

function CardBody({
  icon: Icon,
  tone,
  bg,
  title,
  value,
  line1,
  line2,
  noWrap,
}: {
  icon: any;
  tone: string;
  bg: string;
  title: string;
  value: string;
  line1: string;
  line2: string;
  noWrap?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', bg)}>
        <Icon className={cn('h-5 w-5', tone)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{title}</p>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className={cn('text-xs text-foreground/80', noWrap && 'truncate')}>{line1}</p>
        <p className={cn('text-xs text-muted-foreground', noWrap && 'truncate')}>{line2}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

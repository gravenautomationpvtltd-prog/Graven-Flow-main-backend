import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Clock,
  Download,
  Gauge,
  Inbox,
  Package,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useProcurementScorecard,
  useProcurementTeamBoard,
  type ProcurementScorecard,
} from '@/hooks/useProcurementScorecard';
import { PriceGapTrends } from '@/components/procurement/PriceGapTrends';
import { SupplierPriceAnalytics } from '@/components/procurement/SupplierPriceAnalytics';
import { BenchmarkVariance } from '@/components/procurement/BenchmarkVariance';
import { BenchmarkSetupDialog } from '@/components/procurement/BenchmarkSetupDialog';
import { TargetMatchWorkflow } from '@/components/procurement/TargetMatchWorkflow';
import { useTargetMatchScorecard } from '@/hooks/useTargetMatchScorecard';
import { useBenchmarks, useOfficesList } from '@/hooks/useBenchmarks';
import { VarianceDrilldown } from '@/components/procurement/VarianceDrilldown';

const DEPARTMENTS = [
  { value: 'all', label: 'All departments' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'import_procurement', label: 'Import procurement' },
  { value: 'sales', label: 'Sales' },
  { value: 'cct', label: 'CCT' },
];


const inr = (n: number) => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};
const hrs = (h: number) => (h < 1 ? `${Math.round(h * 60)}m` : h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`);
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

function periodRange(key: string): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const now = new Date();
  let from: Date;
  let to = now;
  if (key === 'this_month') from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (key === 'last_month') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (key === 'quarter') from = new Date(now.getTime() - 90 * 864e5);
  else if (key === 'year') from = new Date(now.getTime() - 365 * 864e5);
  else from = new Date(now.getTime() - 30 * 864e5);
  const span = to.getTime() - from.getTime();
  return { from, to, prevFrom: new Date(from.getTime() - span), prevTo: from };
}

function Delta({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  if (!previous) return null;
  const change = ((current - previous) / previous) * 100;
  const good = invert ? change < 0 : change > 0;
  return (
    <span className={`text-[11px] font-medium ${good ? 'text-emerald-600' : 'text-destructive'}`}>
      {change > 0 ? '+' : ''}
      {change.toFixed(0)}% vs prev
    </span>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  onClick,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  tone?: 'default' | 'warn' | 'good';
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={onClick ? 'cursor-pointer transition-colors hover:border-primary/60' : undefined}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon
            className={`h-4 w-4 ${
              tone === 'warn'
                ? 'text-destructive'
                : tone === 'good'
                ? 'text-emerald-600'
                : 'text-muted-foreground'
            }`}
          />
        </div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        {children}
      </CardContent>
    </Card>
  );
}

export default function ProcurementPerformance() {
  const navigate = useNavigate();
  const { user, isAdmin, hasRole } = useAuth();
  const isLeader =
    isAdmin || hasRole('coo') || hasRole('super_admin') || hasRole('procurement_manager') || hasRole('manager');

  const [period, setPeriod] = useState('this_month');
  const [scope, setScope] = useState<string>(isLeader ? 'all' : 'me');

  const { from, to, prevFrom, prevTo } = useMemo(() => periodRange(period), [period]);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const userFilter = scope === 'all' ? null : scope === 'me' ? user?.id ?? null : scope;
  const { data: sc, isLoading } = useProcurementScorecard(fromIso, toIso, userFilter);
  const { data: prev } = useProcurementScorecard(prevFrom.toISOString(), prevTo.toISOString(), userFilter);
  const { data: board = [], isLoading: loadingBoard } = useProcurementTeamBoard(fromIso, toIso);

  const s: ProcurementScorecard | undefined = sc;

  const funnel = s
    ? [
        { stage: 'Raised', value: s.requests_raised },
        { stage: 'Priced', value: s.prices_given },
        { stage: 'Pushed', value: s.quotes_pushed },
        { stage: 'Target met', value: s.target_matched },
      ]
    : [];

  const ageing = s
    ? [
        { bucket: '0-1d', value: s.age_0_1, tone: '#22c55e' },
        { bucket: '1-3d', value: s.age_1_3, tone: '#eab308' },
        { bucket: '3-7d', value: s.age_3_7, tone: '#f97316' },
        { bucket: '7d+', value: s.age_7_plus, tone: '#ef4444' },
      ]
    : [];

  const tatCompliance = s ? pct(s.tat_met, s.tat_met + s.tat_missed) : 0;
  const coverage = s ? pct(s.prices_given, s.requests_raised) : 0;

  const { data: benchmarks = [] } = useBenchmarks('procurement');
  const { data: offices = [] } = useOfficesList();
  const [benchRegion, setBenchRegion] = useState<string>('all');
  const [benchDept, setBenchDept] = useState<string>('procurement');
  const [benchOpen, setBenchOpen] = useState(false);
  const [drill, setDrill] = useState<{ metric: string; actual: number | null; target: number | null } | null>(
    null,
  );
  const benchOfficeId = benchRegion === 'all' ? null : benchRegion;
  const regionLabel =
    offices.find((o) => o.id === benchOfficeId)?.name ?? 'Company-wide';
  const departmentLabel =
    DEPARTMENTS.find((d) => d.value === benchDept)?.label ?? 'All departments';

  const { data: tm, isLoading: loadingTm } = useTargetMatchScorecard(
    fromIso,
    toIso,
    benchOfficeId,
    benchDept,
  );

  // Benchmark variance is measured on the same region/department slice as the
  // target-matched workflow so targets and actuals always line up.
  const actuals = tm
    ? {
        coverage_pct: tm.coverage_pct,
        tat_compliance_pct: tm.tat_compliance_pct,
        target_match_pct: tm.target_requests > 0 ? tm.target_match_pct : null,
        price_gap_pct: tm.target_requests > 0 ? tm.price_gap_pct : null,
        avg_resolution_hours: tm.avg_resolution_hours,
        no_price_rate_pct: tm.no_price_rate_pct,
        multi_quote_pct: s && s.quoted_items > 0 ? pct(s.multi_quote_items, s.quoted_items) : null,
        backlog_open: tm.backlog_open,
      }
    : null;




  const exportBoard = () => {
    const head = [
      'Member', 'Assigned', 'Open now', 'Priced', 'No price', 'Avg resolution (h)',
      'TAT met', 'TAT missed', 'Breached open', 'Quotes captured', 'Target met', 'POs', 'PO value',
    ];
    const body = board.map((r) => [
      r.user_name, r.assigned_count, r.open_count, r.resolved_count, r.no_price_count,
      r.avg_resolution_hours.toFixed(1), r.tat_met, r.tat_missed, r.breached_open,
      r.quotes_captured, r.target_matched, r.po_count, Math.round(r.po_value),
    ]);
    const csv = [head, ...body].map((l) => l.map((c) => `"${String(c ?? '')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'procurement-team-performance.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" />
            Procurement performance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Demand, speed, commercial quality and supplier activity for the selected period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isLeader && (
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-9 w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Whole department</SelectItem>
                <SelectItem value="me">Only my work</SelectItem>
                {board.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.user_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={benchRegion} onValueChange={setBenchRegion}>
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Benchmark: company-wide</SelectItem>
              {offices.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  Benchmark: {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={benchDept} onValueChange={setBenchDept}>
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="quarter">Last 90 days</SelectItem>
              <SelectItem value="year">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alerts */}
      {s && (s.breached_open > 0 || s.requests_unassigned > 0 || s.age_7_plus > 0) && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="font-medium">Needs attention:</span>
            {s.requests_unassigned > 0 && (
              <Badge variant="outline" className="cursor-pointer" onClick={() => navigate('/procurement/queue')}>
                {s.requests_unassigned} unassigned
              </Badge>
            )}
            {s.breached_open > 0 && (
              <Badge variant="destructive" className="cursor-pointer" onClick={() => navigate('/procurement/queue')}>
                {s.breached_open} past TAT
              </Badge>
            )}
            {s.escalated_open > 0 && <Badge variant="outline">{s.escalated_open} escalated</Badge>}
            {s.age_7_plus > 0 && <Badge variant="outline">{s.age_7_plus} older than 7 days</Badge>}
          </CardContent>
        </Card>
      )}

      {isLoading || !s ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Price requests raised"
              value={s.requests_raised.toLocaleString('en-IN')}
              icon={Inbox}
              onClick={() => navigate('/procurement/queue')}
            >
              <Delta current={s.requests_raised} previous={prev?.requests_raised ?? 0} />
            </Kpi>
            <Kpi
              label="Prices given"
              value={s.prices_given.toLocaleString('en-IN')}
              sub={`${coverage.toFixed(0)}% coverage · ${s.no_price} no-price`}
              icon={TrendingUp}
              tone="good"
            >
              <Delta current={s.prices_given} previous={prev?.prices_given ?? 0} />
            </Kpi>
            <Kpi
              label="Open backlog"
              value={s.backlog_open.toLocaleString('en-IN')}
              sub={`Oldest ${s.oldest_open_days.toFixed(0)} days`}
              icon={Package}
              tone={s.backlog_open > 0 ? 'warn' : 'default'}
              onClick={() => navigate('/procurement/queue')}
            />
            <Kpi
              label="Avg resolution time"
              value={hrs(s.avg_resolution_hours)}
              sub={`Median ${hrs(s.median_resolution_hours)}`}
              icon={Clock}
            >
              <Delta current={s.avg_resolution_hours} previous={prev?.avg_resolution_hours ?? 0} invert />
            </Kpi>
            <Kpi
              label="TAT compliance"
              value={`${tatCompliance.toFixed(0)}%`}
              sub={`${s.tat_met} on time · ${s.tat_missed} late`}
              icon={Target}
              tone={tatCompliance >= 80 ? 'good' : 'warn'}
            >
              <Progress value={tatCompliance} className="h-1.5 mt-2" />
            </Kpi>
            <Kpi
              label="Target price match"
              value={
                s.target_requests > 0 ? `${pct(s.target_matched, s.target_requests).toFixed(0)}%` : '—'
              }
              sub={`${s.target_matched} of ${s.target_requests} with a target${
                s.avg_gap_vs_target_pct ? ` · avg gap ${s.avg_gap_vs_target_pct.toFixed(1)}%` : ''
              }`}
              icon={Target}
            />
            <Kpi
              label="Supplier quotes captured"
              value={s.quotes_captured.toLocaleString('en-IN')}
              sub={
                s.quoted_items > 0
                  ? `${pct(s.multi_quote_items, s.quoted_items).toFixed(0)}% items with 2+ quotes · ${
                      s.suppliers_quoted
                    } suppliers`
                  : 'No quotes captured yet'
              }
              icon={Users}
            />
            <Kpi
              label="Purchase orders"
              value={`${s.po_count} · ${inr(s.po_value)}`}
              sub={`${s.grn_count} GRNs · ${s.suppliers_new} new suppliers`}
              icon={Package}
            >
              <Delta current={s.po_value} previous={prev?.po_value ?? 0} />
            </Kpi>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Request funnel</CardTitle>
              </CardHeader>
              <CardContent className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnel} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis dataKey="stage" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Open backlog ageing</CardTitle>
              </CardHeader>
              <CardContent className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageing} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis dataKey="bucket" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {ageing.map((a) => (
                        <Cell key={a.bucket} fill={a.tone} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <TargetMatchWorkflow
            data={tm}
            isLoading={loadingTm}
            regionLabel={regionLabel}
            departmentLabel={departmentLabel}
            onDrill={(metric, actual) => setDrill({ metric, actual, target: null })}
          />

          {actuals && (

            <BenchmarkVariance
              benchmarks={benchmarks}
              actuals={actuals}
              officeId={benchOfficeId}
              regionLabel={regionLabel}
              canEdit={isLeader}
              onSetup={() => setBenchOpen(true)}
              onDrill={(metric, actual, target) => setDrill({ metric, actual, target })}
            />
          )}
        </>
      )}

      <VarianceDrilldown
        metric={drill?.metric ?? null}
        onOpenChange={(v) => !v && setDrill(null)}
        from={fromIso}
        to={toIso}
        officeId={benchOfficeId}
        department={benchDept}
        regionLabel={regionLabel}
        departmentLabel={departmentLabel}
        actualValue={drill?.actual ?? null}
        targetValue={drill?.target ?? null}
      />

      <BenchmarkSetupDialog open={benchOpen} onOpenChange={setBenchOpen} defaultDepartment="procurement" />


      {isLeader && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Team board</CardTitle>
            <Button variant="outline" size="sm" className="h-8" onClick={exportBoard}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              CSV
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loadingBoard ? (
              <Skeleton className="h-40 w-full" />
            ) : board.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No procurement team members found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Assigned</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                    <TableHead className="text-right">Priced</TableHead>
                    <TableHead className="text-right">No price</TableHead>
                    <TableHead className="text-right">Avg time</TableHead>
                    <TableHead className="text-right">TAT %</TableHead>
                    <TableHead className="text-right">Past TAT</TableHead>
                    <TableHead className="text-right">Quotes</TableHead>
                    <TableHead className="text-right">Target met</TableHead>
                    <TableHead className="text-right">POs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {board.map((r) => {
                    const tat = pct(r.tat_met, r.tat_met + r.tat_missed);
                    return (
                      <TableRow
                        key={r.user_id}
                        className="cursor-pointer"
                        onClick={() => setScope(r.user_id)}
                      >
                        <TableCell className="font-medium">{r.user_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.assigned_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.open_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.resolved_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.no_price_count}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.resolved_count ? hrs(r.avg_resolution_hours) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.tat_met + r.tat_missed ? `${tat.toFixed(0)}%` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.breached_open ? (
                            <Badge variant="destructive">{r.breached_open}</Badge>
                          ) : (
                            '0'
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.quotes_captured}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.target_matched}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.po_count} · {inr(r.po_value)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <PriceGapTrends />
      {isLeader && <SupplierPriceAnalytics />}
    </div>
  );
}

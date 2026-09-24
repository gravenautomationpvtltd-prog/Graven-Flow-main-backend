import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubordinates } from '@/hooks/useSubordinates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  Users,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShoppingCart,
  Package,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

type DatePreset =
  | 'all_time'
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_year'
  | 'last_year'
  | 'custom';

function resolveDateRange(
  preset: DatePreset,
  customFrom?: Date,
  customTo?: Date
): { from?: Date; to?: Date } {
  if (preset === 'custom') return { from: customFrom, to: customTo };
  if (preset === 'all_time') return {};
  const today = new Date();
  switch (preset) {
    case 'this_month':
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: new Date(today.getFullYear(), today.getMonth() + 1, 0),
      };
    case 'last_month':
      return {
        from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        to: new Date(today.getFullYear(), today.getMonth(), 0),
      };
    case 'last_30_days':
      return { from: new Date(today.getTime() - 30 * 86400000), to: today };
    case 'last_90_days':
      return { from: new Date(today.getTime() - 90 * 86400000), to: today };
    case 'this_year':
      return {
        from: new Date(today.getFullYear(), 0, 1),
        to: new Date(today.getFullYear(), 11, 31),
      };
    case 'last_year':
      return {
        from: new Date(today.getFullYear() - 1, 0, 1),
        to: new Date(today.getFullYear() - 1, 11, 31),
      };
    default:
      return {};
  }
}

export default function ProcurementTeamReports() {
  const { profile } = useAuth();
  const { data: subordinates = [], isLoading: subsLoading } = useSubordinates();

  const [datePreset, setDatePreset] = useState<DatePreset>('last_30_days');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const range = useMemo(
    () => resolveDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo]
  );

  const teamMembers = useMemo(() => {
    const list = [...subordinates];
    if (profile && !list.find((m) => m.id === profile.id)) {
      list.unshift({
        id: profile.id,
        full_name: profile.full_name || 'Me',
        email: profile.email || '',
      });
    }
    return list;
  }, [subordinates, profile]);

  const teamIds = useMemo(() => teamMembers.map((m) => m.id), [teamMembers]);

  // Price requests scoped to team within date range
  const { data: priceRequests = [], isLoading: prLoading } = useQuery({
    queryKey: ['ptr-price-requests', teamIds.join(','), range.from?.toISOString(), range.to?.toISOString()],
    enabled: teamIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from('price_requests')
        .select('id, status, assigned_to, requested_at, created_at, resolved_at, tat_deadline')
        .in('assigned_to', teamIds)
        .limit(2000);
      if (range.from) q = q.gte('created_at', range.from.toISOString());
      if (range.to) q = q.lte('created_at', range.to.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Purchase orders scoped to team
  const { data: pos = [], isLoading: poLoading } = useQuery({
    queryKey: ['ptr-pos', teamIds.join(','), range.from?.toISOString(), range.to?.toISOString()],
    enabled: teamIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from('purchase_orders')
        .select('id, status, grand_total, created_at, created_by')
        .in('created_by', teamIds)
        .limit(2000);
      if (range.from) q = q.gte('created_at', range.from.toISOString());
      if (range.to) q = q.lte('created_at', range.to.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // GRNs scoped to team
  const { data: grns = [] } = useQuery({
    queryKey: ['ptr-grns', teamIds.join(','), range.from?.toISOString(), range.to?.toISOString()],
    enabled: teamIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from('goods_receipt_notes')
        .select('id, status, received_by, created_at')
        .in('received_by', teamIds)
        .limit(2000);
      if (range.from) q = q.gte('created_at', range.from.toISOString());
      if (range.to) q = q.lte('created_at', range.to.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Per-member aggregation
  const teamRows = useMemo(() => {
    const now = Date.now();
    return teamMembers.map((m) => {
      const member = priceRequests.filter((p: any) => p.assigned_to === m.id);
      const pending = member.filter((p: any) => !p.resolved_at).length;
      const resolved = member.filter((p: any) => p.resolved_at).length;
      const overdue = member.filter(
        (p: any) => !p.resolved_at && p.tat_deadline && new Date(p.tat_deadline).getTime() < now
      ).length;
      const tats = member
        .filter((p: any) => p.resolved_at && (p.requested_at || p.created_at))
        .map(
          (p: any) =>
            (new Date(p.resolved_at).getTime() -
              new Date(p.requested_at || p.created_at).getTime()) /
            36e5
        );
      const avgTat = tats.length ? tats.reduce((a, b) => a + b, 0) / tats.length : null;
      const onTime = member.filter(
        (p: any) =>
          p.resolved_at &&
          p.tat_deadline &&
          new Date(p.resolved_at).getTime() <= new Date(p.tat_deadline).getTime()
      ).length;
      const onTimePct = resolved > 0 ? Math.round((onTime / resolved) * 100) : null;
      const memberPos = pos.filter((po: any) => po.created_by === m.id);
      const poValue = memberPos.reduce((s, p: any) => s + (Number(p.grand_total) || 0), 0);
      const memberGrns = grns.filter((g: any) => g.received_by === m.id).length;
      return {
        id: m.id,
        name: m.full_name,
        pending,
        resolved,
        overdue,
        avgTat,
        onTimePct,
        posCreated: memberPos.length,
        poValue,
        grns: memberGrns,
      };
    });
  }, [teamMembers, priceRequests, pos, grns]);

  // KPIs
  const totalPending = teamRows.reduce((s, r) => s + r.pending, 0);
  const totalResolved = teamRows.reduce((s, r) => s + r.resolved, 0);
  const totalOverdue = teamRows.reduce((s, r) => s + r.overdue, 0);
  const avgTatHours = (() => {
    const valid = teamRows.filter((r) => r.avgTat != null);
    if (!valid.length) return null;
    return valid.reduce((s, r) => s + (r.avgTat || 0), 0) / valid.length;
  })();
  const totalPos = pos.length;
  const totalPoValue = pos.reduce((s, p: any) => s + (Number(p.grand_total) || 0), 0);
  const pendingGrns = grns.filter((g: any) => g.status !== 'completed').length;

  // Daily trend (created vs resolved) over selected window (cap at 60 days for chart)
  const trendData = useMemo(() => {
    const days = (() => {
      if (!range.from || !range.to) return 30;
      const d = Math.ceil((range.to.getTime() - range.from.getTime()) / 86400000);
      return Math.min(Math.max(d, 7), 60);
    })();
    const end = range.to ?? new Date();
    const buckets: { date: string; created: number; resolved: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      buckets.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        created: 0,
        resolved: 0,
      });
    }
    const startIdx = (dateStr: string) => {
      const d = new Date(dateStr);
      const diff = Math.floor((end.getTime() - d.getTime()) / 86400000);
      return days - 1 - diff;
    };
    priceRequests.forEach((p: any) => {
      const cIdx = startIdx(p.created_at);
      if (cIdx >= 0 && cIdx < days) buckets[cIdx].created += 1;
      if (p.resolved_at) {
        const rIdx = startIdx(p.resolved_at);
        if (rIdx >= 0 && rIdx < days) buckets[rIdx].resolved += 1;
      }
    });
    return buckets;
  }, [priceRequests, range.from, range.to]);

  const isLoading = subsLoading || prLoading || poLoading;

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Team Reports | Procurement | Graven OneDesk</title>
      </Helmet>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Procurement Team Reports
          </h1>
          <p className="text-muted-foreground">
            Performance of your procurement team only — {teamMembers.length} member
            {teamMembers.length === 1 ? '' : 's'}
          </p>
        </div>
        <DateRangeFilter
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Inbox}
          label="Open Price Requests"
          value={isLoading ? null : totalPending}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Overdue"
          value={isLoading ? null : totalOverdue}
          tone={totalOverdue > 0 ? 'destructive' : undefined}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Resolved"
          value={isLoading ? null : totalResolved}
        />
        <KpiCard
          icon={Clock}
          label="Avg TAT (hrs)"
          value={isLoading ? null : avgTatHours != null ? avgTatHours.toFixed(1) : '—'}
        />
        <KpiCard
          icon={ShoppingCart}
          label="POs Created"
          value={isLoading ? null : totalPos}
        />
        <KpiCard
          icon={BarChart3}
          label="PO Value"
          value={isLoading ? null : `₹${Math.round(totalPoValue).toLocaleString('en-IN')}`}
        />
        <KpiCard
          icon={Package}
          label="Pending GRNs"
          value={isLoading ? null : pendingGrns}
        />
        <KpiCard
          icon={Users}
          label="Team Members"
          value={isLoading ? null : teamMembers.length}
        />
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Price Requests — Created vs Resolved
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="created" fill="hsl(var(--primary))" name="Created" />
                  <Bar dataKey="resolved" fill="hsl(var(--accent))" name="Resolved" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team performance table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Member Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : teamRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No team members found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                    <TableHead className="text-right">Resolved</TableHead>
                    <TableHead className="text-right">Avg TAT (hrs)</TableHead>
                    <TableHead className="text-right">On-time %</TableHead>
                    <TableHead className="text-right">POs</TableHead>
                    <TableHead className="text-right">PO Value</TableHead>
                    <TableHead className="text-right">GRNs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.pending}</TableCell>
                      <TableCell className="text-right">
                        {r.overdue > 0 ? (
                          <Badge variant="destructive">{r.overdue}</Badge>
                        ) : (
                          0
                        )}
                      </TableCell>
                      <TableCell className="text-right">{r.resolved}</TableCell>
                      <TableCell className="text-right">
                        {r.avgTat != null ? r.avgTat.toFixed(1) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.onTimePct != null ? `${r.onTimePct}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right">{r.posCreated}</TableCell>
                      <TableCell className="text-right">
                        ₹{Math.round(r.poValue).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="text-right">{r.grns}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string | null;
  tone?: 'destructive';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            {value === null ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p
                className={`text-2xl font-bold ${
                  tone === 'destructive' ? 'text-destructive' : ''
                }`}
              >
                {value}
              </p>
            )}
          </div>
          <Icon
            className={`h-5 w-5 ${
              tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground'
            }`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

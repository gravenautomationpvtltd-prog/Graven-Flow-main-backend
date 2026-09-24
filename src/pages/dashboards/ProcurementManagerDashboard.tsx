import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubordinates } from '@/hooks/useSubordinates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  FileText,
  FileEdit,
  Send,
  Truck,
  CheckCircle2,
  Users,
  ShoppingCart,
  Package,
  TrendingUp,
  ArrowUpRight,
  ListChecks,
  AlertTriangle,
  Shuffle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type TeamRow = {
  id: string;
  name: string;
  email: string;
  pending: number;
  resolvedToday: number;
  overdue: number;
  avgTatHours: number | null;
};

const ORDERED_STATUSES = ['approved', 'sent_to_supplier', 'partially_received'];
const DELIVERED_STATUSES = ['delivered', 'completed', 'received'];

export default function ProcurementManagerDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { data: subordinates = [], isLoading: subsLoading } = useSubordinates();

  const teamIds = useMemo(
    () => [profile?.id, ...subordinates.map(s => s.id)].filter(Boolean) as string[],
    [profile?.id, subordinates]
  );

  // Price-request data — kept ONLY for Team Performance table
  const { data: prData, isLoading: prLoading } = useQuery({
    queryKey: ['proc-mgr-price-requests-team', teamIds.join(',')],
    enabled: teamIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_requests')
        .select('id, status, assigned_to, created_at, resolved_at, tat_deadline')
        .in('assigned_to', teamIds)
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  // All POs by team — for lifecycle KPIs
  const { data: allPOs, isLoading: poLoading } = useQuery({
    queryKey: ['proc-mgr-all-pos', teamIds.join(',')],
    enabled: teamIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_number, status, grand_total, created_at, created_by, expected_delivery, supplier:suppliers(name)')
        .in('created_by', teamIds)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  // Pending GRNs (received but not finalized) — supplier-side
  const { data: grnData } = useQuery({
    queryKey: ['proc-mgr-grns'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goods_receipt_notes')
        .select('id, status')
        .neq('status', 'completed')
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // Orphan-brand items routed via round-robin (no brand owner)
  const { data: orphanItems } = useQuery({
    queryKey: ['proc-mgr-orphan-brands'],
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('enquiry_items' as any)
        .select('id', { count: 'exact', head: true })
        .eq('routed_via', 'round_robin')
        .or('quotation_status.is.null,quotation_status.eq.pending');
      if (error) throw error;
      return count || 0;
    },
  });

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = new Date().toISOString().slice(0, 10);

  // PO lifecycle stats
  const poLifecycle = useMemo(() => {
    const all = allPOs || [];
    const draft = all.filter(p => p.status === 'draft' || p.status === 'pending_approval');
    const ordered = all.filter(p => ORDERED_STATUSES.includes(p.status as string));
    const delivered = all.filter(p => DELIVERED_STATUSES.includes(p.status as string));
    const pendingDelivery = ordered.filter(p => !p.expected_delivery || p.expected_delivery <= todayISO || true)
      .filter(p => !DELIVERED_STATUSES.includes(p.status as string));
    // Sort pending delivery by nearest/most overdue expected_delivery
    const pendingSorted = [...ordered]
      .filter(p => !DELIVERED_STATUSES.includes(p.status as string))
      .sort((a, b) => {
        const ad = a.expected_delivery ? new Date(a.expected_delivery).getTime() : Infinity;
        const bd = b.expected_delivery ? new Date(b.expected_delivery).getTime() : Infinity;
        return ad - bd;
      });
    return {
      total: all.length,
      draft: draft.length,
      ordered: ordered.length,
      pendingDelivery: pendingSorted.length,
      delivered: delivered.length,
      pendingTop: pendingSorted.slice(0, 5),
    };
  }, [allPOs, todayISO]);

  // 7-day stats from same allPOs (reuse, no extra query)
  const poStats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const recent = (allPOs || []).filter(p => new Date(p.created_at).getTime() >= weekAgo);
    const totalValue = recent.reduce((sum, p) => sum + (p.grand_total || 0), 0);
    return { total: recent.length, totalValue };
  }, [allPOs]);

  const teamRows: TeamRow[] = useMemo(() => {
    const all = prData || [];
    const team = [profile && { id: profile.id, full_name: profile.full_name || 'Me', email: profile.email || '' }, ...subordinates].filter(Boolean) as Array<{id: string; full_name: string; email: string}>;
    return team.map(member => {
      const mine = all.filter(r => r.assigned_to === member.id);
      const pending = mine.filter(r => r.status === 'pending' || r.status === 'in_progress').length;
      const overdue = mine.filter(r => (r.status === 'pending' || r.status === 'in_progress') && r.tat_deadline && new Date(r.tat_deadline).getTime() < now).length;
      const resolvedToday = mine.filter(r => r.status === 'resolved' && r.resolved_at && new Date(r.resolved_at) >= todayStart).length;
      const tats = mine
        .filter(r => r.status === 'resolved' && r.resolved_at)
        .map(r => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 36e5);
      const avgTatHours = tats.length ? tats.reduce((a, b) => a + b, 0) / tats.length : null;
      return {
        id: member.id,
        name: member.full_name,
        email: member.email,
        pending,
        overdue,
        resolvedToday,
        avgTatHours,
      };
    }).sort((a, b) => b.pending - a.pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prData, subordinates, profile?.id]);

  const pendingGRNs = grnData?.length || 0;

  const loading = subsLoading || poLoading;

  const formatINR = (n: number) =>
    n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;

  const kpis = [
    { title: 'Total POs', value: poLifecycle.total, icon: FileText, color: 'text-info', bg: 'bg-info/10', onClick: () => navigate('/procurement') },
    { title: 'Draft / In Approval', value: poLifecycle.draft, icon: FileEdit, color: 'text-amber-600', bg: 'bg-amber-500/10', onClick: () => navigate('/procurement?status=draft') },
    { title: 'Ordered', value: poLifecycle.ordered, icon: Send, color: 'text-purple-600', bg: 'bg-purple-500/10', onClick: () => navigate('/procurement?status=approved') },
    { title: 'Pending Delivery', value: poLifecycle.pendingDelivery, icon: Truck, color: 'text-destructive', bg: 'bg-destructive/10', onClick: () => navigate('/procurement?status=sent_to_supplier') },
    { title: 'Received', value: poLifecycle.delivered, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', onClick: () => navigate('/procurement?status=delivered') },
    { title: 'Orphan-brand items', value: orphanItems ?? 0, icon: Shuffle, color: 'text-amber-600', bg: 'bg-amber-500/10', onClick: () => navigate('/settings/brand-mapping') },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-display font-bold">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Manager'}
        </h1>
        <p className="text-muted-foreground">
          Here's your procurement team's workload — {teamIds.length} member{teamIds.length === 1 ? '' : 's'}.
        </p>
      </div>

      {/* PO Lifecycle KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <Card
            key={k.title}
            className={`stat-card hover:border-primary/30 transition-all ${k.onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
            onClick={k.onClick}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.title}</CardTitle>
              <div className={`p-2 rounded-lg ${k.bg}`}>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-3xl font-bold font-display">{k.value}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team performance + Pending Delivery POs */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Team Performance</CardTitle>
              <CardDescription>Workload across your procurement team</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/procurement/queue')}>
              Open Queue <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {prLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : teamRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No team members yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                    <TableHead className="text-right">Resolved Today</TableHead>
                    <TableHead className="text-right">Avg TAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamRows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </TableCell>
                      <TableCell className="text-right">{r.pending}</TableCell>
                      <TableCell className="text-right">
                        {r.overdue > 0 ? <Badge variant="destructive">{r.overdue}</Badge> : '0'}
                      </TableCell>
                      <TableCell className="text-right">{r.resolvedToday}</TableCell>
                      <TableCell className="text-right">{r.avgTatHours !== null ? `${r.avgTatHours.toFixed(1)}h` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-destructive" /> Pending Delivery POs</CardTitle>
            <CardDescription>Nearest & overdue deliveries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : poLifecycle.pendingTop.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No pending deliveries 🎉</p>
            ) : (
              poLifecycle.pendingTop.map((p: any) => {
                const supplier = Array.isArray(p.supplier) ? p.supplier[0] : p.supplier;
                const exp = p.expected_delivery ? new Date(p.expected_delivery) : null;
                const overdue = exp && exp.getTime() < now;
                const daysDiff = exp ? Math.round((exp.getTime() - now) / (24 * 3600 * 1000)) : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/procurement/po/${p.id}`)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.po_number}</p>
                        <p className="text-xs text-muted-foreground truncate">{supplier?.name || '—'}</p>
                      </div>
                      {exp ? (
                        <Badge variant={overdue ? 'destructive' : 'secondary'} className="shrink-0">
                          {overdue ? `${Math.abs(daysDiff!)}d late` : daysDiff === 0 ? 'Today' : `in ${daysDiff}d`}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">No ETA</Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supplier activity */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/procurement')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">POs Raised (7d)</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{poStats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">by your team this week</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/procurement')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">PO Value (7d)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{formatINR(poStats.totalValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">total committed</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/procurement')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending GRNs</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display">{pendingGRNs}</div>
            <p className="text-xs text-muted-foreground mt-1">awaiting receipt</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/supplier-network/suppliers')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Supplier Network</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">Manage suppliers, RFQs & quotations</div>
            <p className="text-xs text-muted-foreground mt-1">Open supplier hub →</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

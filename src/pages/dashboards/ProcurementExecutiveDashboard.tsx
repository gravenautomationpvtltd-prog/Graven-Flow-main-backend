import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  ShoppingCart,
  Package,
  TrendingUp,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  ListChecks,
} from 'lucide-react';

const ORDERED_STATUSES = ['approved', 'sent_to_supplier', 'partially_received'];
const DELIVERED_STATUSES = ['delivered', 'completed', 'received'];

export default function ProcurementExecutiveDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const userId = profile?.id;

  // My price requests only
  const { data: prData, isLoading: prLoading } = useQuery({
    queryKey: ['proc-exec-price-requests', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_requests')
        .select('id, status, created_at, resolved_at, tat_deadline')
        .eq('assigned_to', userId!)
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  // My POs only
  const { data: myPOs, isLoading: poLoading } = useQuery({
    queryKey: ['proc-exec-my-pos', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_number, status, grand_total, created_at, expected_delivery, supplier:suppliers(name)')
        .eq('created_by', userId!)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const now = Date.now();
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Personal price-request KPIs
  const myStats = useMemo(() => {
    const all = prData || [];
    const pending = all.filter(r => r.status === 'pending' || r.status === 'in_progress');
    const overdue = pending.filter(r => r.tat_deadline && new Date(r.tat_deadline).getTime() < now);
    const resolvedToday = all.filter(r => r.status === 'resolved' && r.resolved_at && new Date(r.resolved_at) >= todayStart);
    const tats = all
      .filter(r => r.status === 'resolved' && r.resolved_at)
      .map(r => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 36e5);
    const avgTat = tats.length ? tats.reduce((a, b) => a + b, 0) / tats.length : null;
    return {
      pending: pending.length,
      overdue: overdue.length,
      resolvedToday: resolvedToday.length,
      avgTat,
      total: all.length,
    };
  }, [prData, now, todayStart]);

  // PO lifecycle (mine)
  const poLifecycle = useMemo(() => {
    const all = myPOs || [];
    const draft = all.filter(p => p.status === 'draft' || p.status === 'pending_approval');
    const ordered = all.filter(p => ORDERED_STATUSES.includes(p.status as string));
    const delivered = all.filter(p => DELIVERED_STATUSES.includes(p.status as string));
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
  }, [myPOs]);

  // 7-day stats (mine)
  const poStats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const recent = (myPOs || []).filter(p => new Date(p.created_at).getTime() >= weekAgo);
    const totalValue = recent.reduce((sum, p) => sum + (p.grand_total || 0), 0);
    return { total: recent.length, totalValue };
  }, [myPOs]);

  const loading = prLoading || poLoading;

  const formatINR = (n: number) =>
    n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;

  const personalKpis = [
    { title: 'My Pending Requests', value: myStats.pending, icon: Clock, color: 'text-info', bg: 'bg-info/10', onClick: () => navigate('/procurement/queue?tab=mine') },
    { title: 'My Overdue', value: myStats.overdue, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', onClick: () => navigate('/procurement/queue?tab=overdue') },
    { title: 'Resolved Today', value: myStats.resolvedToday, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', onClick: () => navigate('/procurement/queue?tab=completed') },
    { title: 'My Avg TAT', value: myStats.avgTat !== null ? `${myStats.avgTat.toFixed(1)}h` : '—', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-500/10' },
  ];

  const poKpis = [
    { title: 'My Total POs', value: poLifecycle.total, icon: FileText, color: 'text-info', bg: 'bg-info/10', onClick: () => navigate('/procurement') },
    { title: 'Draft / In Approval', value: poLifecycle.draft, icon: FileEdit, color: 'text-amber-600', bg: 'bg-amber-500/10', onClick: () => navigate('/procurement?status=draft') },
    { title: 'Ordered', value: poLifecycle.ordered, icon: Send, color: 'text-purple-600', bg: 'bg-purple-500/10', onClick: () => navigate('/procurement?status=approved') },
    { title: 'Pending Delivery', value: poLifecycle.pendingDelivery, icon: Truck, color: 'text-destructive', bg: 'bg-destructive/10', onClick: () => navigate('/procurement?status=sent_to_supplier') },
    { title: 'Received', value: poLifecycle.delivered, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', onClick: () => navigate('/procurement?status=delivered') },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-display font-bold">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-muted-foreground">
          Here's your personal procurement workload and performance.
        </p>
      </div>

      {/* My Performance KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">My Performance</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {personalKpis.map((k) => (
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
      </div>

      {/* My PO Lifecycle */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">My Purchase Orders</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {poKpis.map((k) => (
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
      </div>

      {/* My Pending Deliveries + 7d activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-destructive" /> My Pending Deliveries</CardTitle>
              <CardDescription>POs you raised that are awaiting delivery</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/procurement')}>
              Open Procurement <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : poLifecycle.pendingTop.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No pending deliveries 🎉</p>
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

        <div className="space-y-4">
          <Card className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/procurement')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">My POs Raised (7d)</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{poStats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">this week</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/procurement')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">My PO Value (7d)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{formatINR(poStats.totalValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">total committed</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate('/supplier-network/suppliers')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Supplier Network</CardTitle>
              <ListChecks className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">Suppliers, RFQs & quotations</div>
              <p className="text-xs text-muted-foreground mt-1">Open hub →</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

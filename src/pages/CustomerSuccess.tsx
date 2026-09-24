import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, ShoppingBag, FileText, MessageSquareOff, Star } from 'lucide-react';
import { useCstCustomers, type CstView, type CstCustomer } from '@/hooks/useCstCustomers';
import { fetchEngagementSummaries } from '@/hooks/useCstEngagements';
import { CstCustomerCard } from '@/components/cst/CstCustomerCard';
import { CstReconnectPanel } from '@/components/cst/CstReconnectPanel';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

type StatusFilter = 'all' | 'not_contacted' | 'contacted_today' | 'overdue' | 'scheduled_today' | 'dnc' | 'favourites';

export default function CustomerSuccess() {
  const { isAdmin, isManager, hasRole, loading } = useAuth();
  const [view, setView] = useState<CstView>('ordered');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [panelCustomer, setPanelCustomer] = useState<CstCustomer | null>(null);

  const { data: customers = [], isLoading } = useCstCustomers(view);
  const { data: ordered = [] } = useCstCustomers('ordered');
  const { data: quotedSilent = [] } = useCstCustomers('quoted_silent');
  const { data: enquiredSilent = [] } = useCstCustomers('enquired_silent');

  const customerIds = customers.map(c => c.id);
  const { data: summaryMap } = useQuery({
    queryKey: ['cst-engagement-summaries', view, customerIds.join(',')],
    enabled: customerIds.length > 0,
    queryFn: () => fetchEngagementSummaries(customerIds),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const now = Date.now();
    const today = new Date().toDateString();
    return customers.filter(c => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const hit = c.company_name.toLowerCase().includes(q) ||
          (c.contact_person || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(search);
        if (!hit) return false;
      }
      // Status
      const s = summaryMap?.get(c.id);
      if (statusFilter === 'favourites' && !c.cst_favourite) return false;
      if (statusFilter === 'dnc' && !c.cst_dnc) return false;
      if (statusFilter === 'not_contacted' && s?.last_engagement_at) return false;
      if (statusFilter === 'contacted_today') {
        if (!s?.last_engagement_at || new Date(s.last_engagement_at).toDateString() !== today) return false;
      }
      if (statusFilter === 'overdue') {
        if (!s?.scheduled_callback_at || new Date(s.scheduled_callback_at).getTime() >= now) return false;
      }
      if (statusFilter === 'scheduled_today') {
        if (!s?.scheduled_callback_at || new Date(s.scheduled_callback_at).toDateString() !== today) return false;
      }
      return true;
    });
  }, [customers, search, statusFilter, summaryMap]);

  if (loading) return null;
  const allowed = isAdmin || isManager || hasRole('cst');
  if (!allowed) return <Navigate to="/dashboard" replace />;

  const stats = [
    { key: 'ordered' as CstView, label: 'Ordered With Us', count: ordered.length, icon: ShoppingBag, tone: 'text-emerald-600' },
    { key: 'quoted_silent' as CstView, label: 'Quoted · Silent 30d+', count: quotedSilent.length, icon: FileText, tone: 'text-amber-600' },
    { key: 'enquired_silent' as CstView, label: 'Enquired · Silent 35d+', count: enquiredSilent.length, icon: MessageSquareOff, tone: 'text-violet-600' },
  ];

  const emptyMessage =
    view === 'ordered' ? 'No paying customers match this filter.'
    : view === 'quoted_silent' ? 'No silent quoted customers.'
    : 'No cold enquiries.';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customer Success</h1>
        <p className="text-muted-foreground">Track every touch and reconnect with silent customers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          const selected = view === s.key;
          return (
            <Card
              key={s.key}
              className={`cursor-pointer transition-all hover:shadow-md ${selected ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setView(s.key)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold mt-1">{s.count}</p>
                  </div>
                  <Icon className={`h-5 w-5 ${s.tone}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as CstView)}>
        <TabsList className="grid grid-cols-3 w-full lg:w-auto">
          <TabsTrigger value="ordered">Ordered</TabsTrigger>
          <TabsTrigger value="quoted_silent">Quoted · Silent 30d+</TabsTrigger>
          <TabsTrigger value="enquired_silent">Enquired · Silent 35d+</TabsTrigger>
        </TabsList>

        <TabsContent value={view} className="mt-4 space-y-4">
          {/* Filters bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search company, contact, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({customers.length})</SelectItem>
                <SelectItem value="favourites"><Star className="h-3 w-3 inline mr-1 fill-yellow-400 text-yellow-400" /> Favourites</SelectItem>
                <SelectItem value="not_contacted">Never contacted</SelectItem>
                <SelectItem value="contacted_today">Contacted today</SelectItem>
                <SelectItem value="scheduled_today">Scheduled today</SelectItem>
                <SelectItem value="overdue">Overdue callback</SelectItem>
                <SelectItem value="dnc">Do not contact</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border rounded-lg bg-muted/20">
              {emptyMessage}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(c => (
                <CstCustomerCard
                  key={c.id}
                  customer={c as any}
                  summary={summaryMap?.get(c.id) ?? {
                    last_engagement_at: null, last_channel: null, last_outcome: null,
                    scheduled_callback_at: null, touches_30d: 0, touches_90d: 0,
                  }}
                  onOpenPanel={setPanelCustomer}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CstReconnectPanel
        customer={panelCustomer}
        open={!!panelCustomer}
        onOpenChange={(v) => !v && setPanelCustomer(null)}
      />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Inbox, Eye, AlertTriangle, Sparkles, MessageSquare, Phone, Trophy } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SptInboxListTable } from '@/components/spt/SptInboxListTable';
import {
  SptInboxFilters,
  applySptFilters,
  defaultSptFilters,
  type SptFiltersState,
  type SptSortOption,
} from '@/components/spt/SptInboxFilters';
import { useSptInbox, type DealStage, dealStageLabels } from '@/hooks/useSptInbox';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'spt-inbox:listState:v2';

type StageTab = 'all' | DealStage;

const STAGE_TAB_ORDER: StageTab[] = ['all', 'new', 'pricing', 'negotiation', 'follow_up', 'won', 'lost'];

const STAGE_TAB_LABEL: Record<StageTab, string> = {
  all: 'All',
  ...dealStageLabels,
};

function parseArr(sp: URLSearchParams, k: string) {
  const v = sp.get(k);
  return v ? v.split(',').filter(Boolean) : [];
}
function parseDate(sp: URLSearchParams, k: string): Date | undefined {
  const v = sp.get(k);
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

function parseFromURL(sp: URLSearchParams): { filters: SptFiltersState; tab: StageTab; page: number; pageSize: number } {
  return {
    filters: {
      search: sp.get('q') || '',
      sortBy: (sp.get('sortBy') as SptSortOption) || 'newest_handoff',
      sources: parseArr(sp, 'sources'),
      segments: parseArr(sp, 'segments'),
      pricingModes: parseArr(sp, 'pricing'),
      slaBuckets: parseArr(sp, 'sla'),
      customerTraits: parseArr(sp, 'traits'),
      itemBuckets: parseArr(sp, 'items'),
      dateFrom: parseDate(sp, 'dateFrom'),
      dateTo: parseDate(sp, 'dateTo'),
      assignedTo: sp.get('assignedTo') || 'all',
    },
    tab: (sp.get('tab') as StageTab) || 'all',
    page: parseInt(sp.get('page') || '0', 10) || 0,
    pageSize: parseInt(sp.get('pageSize') || '50', 10) || 50,
  };
}

function serialize(f: SptFiltersState, tab: StageTab, page: number, pageSize: number): URLSearchParams {
  const p = new URLSearchParams();
  if (f.search) p.set('q', f.search);
  if (f.sortBy !== 'newest_handoff') p.set('sortBy', f.sortBy);
  if (f.sources.length) p.set('sources', f.sources.join(','));
  if (f.segments.length) p.set('segments', f.segments.join(','));
  if (f.pricingModes.length) p.set('pricing', f.pricingModes.join(','));
  if (f.slaBuckets.length) p.set('sla', f.slaBuckets.join(','));
  if (f.customerTraits.length) p.set('traits', f.customerTraits.join(','));
  if (f.itemBuckets.length) p.set('items', f.itemBuckets.join(','));
  if (f.dateFrom) p.set('dateFrom', f.dateFrom.toISOString().split('T')[0]);
  if (f.dateTo) p.set('dateTo', f.dateTo.toISOString().split('T')[0]);
  if (f.assignedTo !== 'all') p.set('assignedTo', f.assignedTo);
  if (tab !== 'all') p.set('tab', tab);
  if (page > 0) p.set('page', String(page));
  if (pageSize !== 50) p.set('pageSize', String(pageSize));
  return p;
}

function hasParams(sp: URLSearchParams) {
  return ['q', 'sortBy', 'sources', 'segments', 'pricing', 'sla', 'traits', 'items', 'dateFrom', 'dateTo', 'assignedTo', 'tab', 'page', 'pageSize'].some(
    (k) => sp.has(k)
  );
}

function isThisMonth(d: Date | string | null) {
  if (!d) return false;
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return false;
  const now = new Date();
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
}

export default function SptInbox() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialized, setInitialized] = useState(false);

  const initial = useMemo(() => {
    if (hasParams(searchParams)) return parseFromURL(searchParams);
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const p = JSON.parse(stored);
        return {
          filters: {
            ...defaultSptFilters,
            ...p.filters,
            dateFrom: p.filters?.dateFrom ? new Date(p.filters.dateFrom) : undefined,
            dateTo: p.filters?.dateTo ? new Date(p.filters.dateTo) : undefined,
          },
          tab: (p.tab as StageTab) || 'all',
          page: p.page || 0,
          pageSize: p.pageSize || 50,
        };
      }
    } catch {}
    return { filters: defaultSptFilters, tab: 'all' as StageTab, page: 0, pageSize: 50 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [filters, setFilters] = useState<SptFiltersState>(initial.filters);
  const [tab, setTab] = useState<StageTab>(initial.tab);
  const [currentPage, setCurrentPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.pageSize);

  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      return;
    }
    const params = serialize(filters, tab, currentPage, pageSize);
    setSearchParams(params, { replace: true });
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        filters: {
          ...filters,
          dateFrom: filters.dateFrom?.toISOString(),
          dateTo: filters.dateTo?.toISOString(),
        },
        tab,
        page: currentPage,
        pageSize,
      })
    );
  }, [filters, tab, currentPage, pageSize, initialized, setSearchParams]);

  // Single source — derives all stages frontend-side
  const { data: allLeads = [], isLoading, error } = useSptInbox('all');

  // Filter (search/source/segment/etc.) once — stage filtering is per-tab
  const filtered = useMemo(() => applySptFilters(allLeads, filters), [allLeads, filters]);

  const stageCounts = useMemo(() => {
    const counts: Record<StageTab, number> = {
      all: filtered.length,
      new: 0,
      pricing: 0,
      negotiation: 0,
      follow_up: 0,
      won: 0,
      lost: 0,
    };
    for (const l of filtered) counts[l.deal_stage]++;
    return counts;
  }, [filtered]);

  const visibleLeads = useMemo(() => {
    if (tab === 'all') return filtered;
    return filtered.filter((l) => l.deal_stage === tab);
  }, [filtered, tab]);

  const kpis = useMemo(() => {
    return {
      newCount: allLeads.filter((l) => l.deal_stage === 'new').length,
      negotiationCount: allLeads.filter((l) => l.deal_stage === 'negotiation').length,
      followUpCount: allLeads.filter((l) => l.deal_stage === 'follow_up').length,
      wonThisMonth: allLeads.filter(
        (l) => l.deal_stage === 'won' && isThisMonth(l.won_at || l.latest_quotation?.sent_at || null)
      ).length,
    };
  }, [allLeads]);

  const handleFiltersChange = (f: SptFiltersState) => {
    setFilters(f);
    setCurrentPage(0);
  };
  const handleTabChange = (v: string) => {
    setTab(v as StageTab);
    setCurrentPage(0);
  };
  const handlePageSizeChange = (s: number) => {
    setPageSize(s);
    setCurrentPage(0);
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-5 max-w-7xl">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Inbox className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Sales Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Qualified leads ready to quote — handed off from LQT, TST, and CRO.
          </p>
        </div>
        {isAdmin && (
          <Badge variant="outline" className="ml-auto bg-primary/10 text-primary border-primary/30">
            <Eye className="h-3 w-3 mr-1" /> Oversight view — all team members
          </Badge>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sales Inbox failed to load</AlertTitle>
          <AlertDescription>
            {(error as Error).message || 'The backend returned an error. Please refresh or contact support if this persists.'}
          </AlertDescription>
        </Alert>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="New Enquiries"
          value={kpis.newCount}
          icon={Sparkles}
          tone="bg-blue-500/10 text-blue-600 dark:text-blue-300"
          onClick={() => handleTabChange('new')}
        />
        <KpiCard
          label="Negotiation Active"
          value={kpis.negotiationCount}
          icon={MessageSquare}
          tone="bg-purple-500/10 text-purple-600 dark:text-purple-300"
          onClick={() => handleTabChange('negotiation')}
        />
        <KpiCard
          label="Pending Follow-up"
          value={kpis.followUpCount}
          icon={Phone}
          tone="bg-amber-500/10 text-amber-600 dark:text-amber-300"
          onClick={() => handleTabChange('follow_up')}
        />
        <KpiCard
          label="Won This Month"
          value={kpis.wonThisMonth}
          icon={Trophy}
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
          onClick={() => handleTabChange('won')}
        />
      </div>

      <SptInboxFilters filters={filters} onFiltersChange={handleFiltersChange} />

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="h-auto flex flex-wrap">
          {STAGE_TAB_ORDER.map((s) => (
            <TabsTrigger key={s} value={s} className="data-[state=active]:font-semibold">
              {STAGE_TAB_LABEL[s]}
              {stageCounts[s] > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({stageCounts[s]})</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-0">
          <SptInboxListTable
            leads={visibleLeads}
            isLoading={isLoading}
            showOwner={isAdmin}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface KpiProps {
  label: string;
  value: number;
  icon: typeof Sparkles;
  tone: string;
  onClick: () => void;
}
function KpiCard({ label, value, icon: Icon, tone, onClick }: KpiProps) {
  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
        <div className={cn('h-8 w-8 rounded-md flex items-center justify-center', tone)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

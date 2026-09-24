import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LeadFilters, type LeadFiltersState } from '@/components/leads/LeadFilters';
import { LeadListTable } from '@/components/leads/LeadListTable';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { useLeads, type LeadFilters as LeadFiltersType, type LeadSortOption } from '@/hooks/useLeads';
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardScope } from '@/hooks/useDashboardScope';
import { DashboardScopeToggle } from '@/components/dashboard/DashboardScopeToggle';
import type { Database } from '@/integrations/supabase/types';

type LeadStatus = Database['public']['Enums']['lead_status'];
type LeadSource = Database['public']['Enums']['lead_source'];
type EscalationLevel = Database['public']['Enums']['escalation_level'];
type EnquiryStatus = Database['public']['Enums']['enquiry_status'];

const STORAGE_KEY = 'leads:listState';
const SCROLL_KEY = 'leads:scrollY';

// Parse URL params to state
function parseFiltersFromURL(searchParams: URLSearchParams): { filters: LeadFiltersState; page: number; pageSize: number } {
  const parseArray = (key: string) => {
    const val = searchParams.get(key);
    return val ? val.split(',').filter(Boolean) : [];
  };
  
  const parseDateSafe = (key: string): Date | undefined => {
    const val = searchParams.get(key);
    if (!val) return undefined;
    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date;
  };

  return {
    filters: {
      statuses: parseArray('statuses'),
      sources: parseArray('sources'),
      escalationLevels: parseArray('escalations'),
      assignedTo: searchParams.get('assignedTo') || 'all',
      search: searchParams.get('q') || '',
      dateFrom: parseDateSafe('dateFrom'),
      dateTo: parseDateSafe('dateTo'),
      sortBy: (searchParams.get('sortBy') as LeadSortOption) || 'newest',
      hasEnquiry: parseArray('hasEnquiry'),
      enquiryStatuses: parseArray('enquiryStatuses'),
      priceMatched: parseArray('priceMatched'),
    },
    page: parseInt(searchParams.get('page') || '0', 10) || 0,
    pageSize: parseInt(searchParams.get('pageSize') || '50', 10) || 50,
  };
}

// Serialize state to URL params
function serializeFiltersToURL(filters: LeadFiltersState, page: number, pageSize: number): URLSearchParams {
  const params = new URLSearchParams();
  
  if (filters.search) params.set('q', filters.search);
  if (filters.statuses.length) params.set('statuses', filters.statuses.join(','));
  if (filters.sources.length) params.set('sources', filters.sources.join(','));
  if (filters.escalationLevels.length) params.set('escalations', filters.escalationLevels.join(','));
  if (filters.assignedTo !== 'all') params.set('assignedTo', filters.assignedTo);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom.toISOString().split('T')[0]);
  if (filters.dateTo) params.set('dateTo', filters.dateTo.toISOString().split('T')[0]);
  if (filters.sortBy !== 'newest') params.set('sortBy', filters.sortBy);
  if (filters.hasEnquiry.length) params.set('hasEnquiry', filters.hasEnquiry.join(','));
  if (filters.enquiryStatuses.length) params.set('enquiryStatuses', filters.enquiryStatuses.join(','));
  if (filters.priceMatched.length) params.set('priceMatched', filters.priceMatched.join(','));
  if (page > 0) params.set('page', String(page));
  if (pageSize !== 50) params.set('pageSize', String(pageSize));
  
  return params;
}

// Check if URL has any lead filter params
function hasURLParams(searchParams: URLSearchParams): boolean {
  const keys = ['q', 'statuses', 'sources', 'escalations', 'assignedTo', 'dateFrom', 'dateTo', 'sortBy', 'hasEnquiry', 'enquiryStatuses', 'priceMatched', 'page', 'pageSize'];
  return keys.some(key => searchParams.has(key));
}

export default function Leads() {
  const { t } = useTranslation();
  const { user, isManager, isAdmin } = useAuth();
  const scope = useDashboardScope();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize state from URL or sessionStorage
  const getInitialState = useCallback(() => {
    // Priority 1: URL params
    if (hasURLParams(searchParams)) {
      return parseFiltersFromURL(searchParams);
    }
    
    // Priority 2: sessionStorage
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          filters: {
            ...parsed.filters,
            dateFrom: parsed.filters.dateFrom ? new Date(parsed.filters.dateFrom) : undefined,
            dateTo: parsed.filters.dateTo ? new Date(parsed.filters.dateTo) : undefined,
          },
          page: parsed.page || 0,
          pageSize: parsed.pageSize || 50,
        };
      }
    } catch {}
    
    // Priority 3: defaults
    return {
      filters: {
        statuses: [],
        sources: [],
        escalationLevels: [],
        assignedTo: 'all',
        search: '',
        dateFrom: undefined,
        dateTo: undefined,
        sortBy: 'newest' as LeadSortOption,
        hasEnquiry: [],
        enquiryStatuses: [],
        priceMatched: [],
      },
      page: 0,
      pageSize: 50,
    };
  }, [searchParams]);

  const initialState = getInitialState();
  const [currentPage, setCurrentPage] = useState(initialState.page);
  const [pageSize, setPageSize] = useState(initialState.pageSize);
  const [filters, setFilters] = useState<LeadFiltersState>(initialState.filters);

  // Sync state to URL and sessionStorage
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      return;
    }
    
    const newParams = serializeFiltersToURL(filters, currentPage, pageSize);
    setSearchParams(newParams, { replace: true });
    
    // Also save to sessionStorage
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      filters: {
        ...filters,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
      },
      page: currentPage,
      pageSize,
    }));
  }, [filters, currentPage, pageSize, isInitialized, setSearchParams]);

  // Restore scroll position after mount
  useEffect(() => {
    const savedScrollY = sessionStorage.getItem(SCROLL_KEY);
    if (savedScrollY) {
      const scrollY = parseInt(savedScrollY, 10);
      if (!isNaN(scrollY)) {
        // Small delay to ensure DOM is ready
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollY);
        });
      }
      sessionStorage.removeItem(SCROLL_KEY);
    }
  }, []);

  // Reset page when filters change
  const handleFiltersChange = (newFilters: LeadFiltersState) => {
    setFilters(newFilters);
    setCurrentPage(0);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(0);
  };

  // Convert array-based filters to query filters
  // For non-managers, ALWAYS force assignedTo to own user id, ignoring stale cached values.
  // Also: when the scope toggle is set to "My work", force the filter even for managers.
  const effectiveAssignedTo = (!isManager && !isAdmin && user?.id)
    ? user.id
    : scope.isPersonal && user?.id
    ? user.id
    : (filters.assignedTo !== 'all' ? filters.assignedTo : undefined);

  const queryFilters: LeadFiltersType = {
    statuses: filters.statuses.length > 0 ? filters.statuses as LeadStatus[] : undefined,
    sources: filters.sources.length > 0 ? filters.sources as LeadSource[] : undefined,
    escalationLevels: filters.escalationLevels.length > 0 ? filters.escalationLevels as EscalationLevel[] : undefined,
    assignedTo: effectiveAssignedTo,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    sortBy: filters.sortBy,
    page: currentPage,
    pageSize: pageSize,
    hasEnquiry: filters.hasEnquiry.length === 1 ? filters.hasEnquiry[0] === 'yes' : undefined,
    enquiryStatuses: filters.enquiryStatuses.length > 0 ? filters.enquiryStatuses as EnquiryStatus[] : undefined,
    priceMatched: filters.priceMatched.length === 1 
      ? (filters.priceMatched[0] === 'matched' ? true : false) 
      : undefined,
  };

  const { data: leadsResult, isLoading } = useLeads(queryFilters);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">{t('leads.title', 'Leads')}</h1>
          <p className="text-muted-foreground">
            {t('leads.subtitle', 'Manage your sales pipeline and customer enquiries')}
            {scope.canToggle && scope.isPersonal && (
              <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Showing only leads assigned to you
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {scope.canToggle && (
            <DashboardScopeToggle mode={scope.mode} onChange={scope.setMode} />
          )}
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('leads.add_lead', 'Add Lead')}
          </Button>
        </div>
      </div>

      <LeadFilters filters={filters} onFiltersChange={handleFiltersChange} />

      <LeadListTable 
        leads={leadsResult?.data} 
        isLoading={isLoading}
        totalCount={leadsResult?.totalCount ?? 0}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
      />

      <CreateLeadDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />
    </div>
  );
}

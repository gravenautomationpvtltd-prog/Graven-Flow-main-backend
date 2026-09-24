import { useState } from 'react';
import { Search, CalendarIcon, X, SlidersHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { LeadFilterPopover } from '@/components/leads/LeadFilterPopover';
import { useVisibleUsers } from '@/hooks/useSubordinates';
import { useAuth } from '@/hooks/useAuth';
import { SEGMENT_OPTIONS } from '@/lib/segment-config';
import { cn } from '@/lib/utils';

export type SptSortOption =
  | 'newest_handoff'
  | 'oldest_handoff'
  | 'most_overdue'
  | 'highest_value'
  | 'highest_qty'
  | 'customer_az';

export interface SptFiltersState {
  search: string;
  sortBy: SptSortOption;
  sources: string[];
  segments: string[];
  pricingModes: string[];
  slaBuckets: string[];
  customerTraits: string[];
  itemBuckets: string[];
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  assignedTo: string;
}

export const defaultSptFilters: SptFiltersState = {
  search: '',
  sortBy: 'newest_handoff',
  sources: [],
  segments: [],
  pricingModes: [],
  slaBuckets: [],
  customerTraits: [],
  itemBuckets: [],
  dateFrom: undefined,
  dateTo: undefined,
  assignedTo: 'all',
};

const sourceOptions = [
  { value: 'lqt_simple', label: 'LQT · Simple' },
  { value: 'lqt_technical', label: 'TST · Technical' },
  { value: 'cro', label: 'CRO' },
  { value: 'direct', label: 'Direct' },
];

const segmentOptions = SEGMENT_OPTIONS.map((s) => ({
  value: s,
  label: s.charAt(0).toUpperCase() + s.slice(1),
}));

const pricingOptions = [
  { value: 'fast', label: 'Fast Mode' },
  { value: 'awaiting', label: 'Awaiting Pricing' },
  { value: 'updated', label: 'Pricing Updated' },
  { value: 'none', label: 'No items priced' },
];

const slaOptions = [
  { value: 'green', label: 'On track (<12h)' },
  { value: 'yellow', label: 'Due soon (12–24h)' },
  { value: 'red', label: 'Overdue (>24h)' },
];

const customerTraitOptions = [
  { value: 'has_phone', label: 'Has phone' },
  { value: 'has_email', label: 'Has email' },
];

const itemBucketOptions = [
  { value: '1', label: '1 item' },
  { value: '2-5', label: '2–5 items' },
  { value: '6+', label: '6+ items' },
];

const sortOptions: { value: SptSortOption; label: string }[] = [
  { value: 'newest_handoff', label: 'Newest Handoff' },
  { value: 'oldest_handoff', label: 'Oldest Handoff' },
  { value: 'most_overdue', label: 'Most Overdue (SLA)' },
  { value: 'highest_value', label: 'Highest Value' },
  { value: 'highest_qty', label: 'Highest Qty' },
  { value: 'customer_az', label: 'Customer A→Z' },
];

interface Props {
  filters: SptFiltersState;
  onFiltersChange: (f: SptFiltersState) => void;
}

export function SptInboxFilters({ filters, onFiltersChange }: Props) {
  const { data: visibleUsers } = useVisibleUsers();
  const { isManager, isAdmin } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const set = <K extends keyof SptFiltersState>(key: K, val: SptFiltersState[K]) =>
    onFiltersChange({ ...filters, [key]: val });

  const moreSections = [
    {
      title: 'Pricing Mode',
      options: pricingOptions,
      selectedValues: filters.pricingModes,
      onChange: (v: string[]) => set('pricingModes', v),
    },
    {
      title: 'SLA Status',
      options: slaOptions,
      selectedValues: filters.slaBuckets,
      onChange: (v: string[]) => set('slaBuckets', v),
    },
    {
      title: 'Customer Type',
      options: customerTraitOptions,
      selectedValues: filters.customerTraits,
      onChange: (v: string[]) => set('customerTraits', v),
    },
    {
      title: 'Item Count',
      options: itemBucketOptions,
      selectedValues: filters.itemBuckets,
      onChange: (v: string[]) => set('itemBuckets', v),
    },
  ];

  const sourceSection = [
    {
      title: 'Handoff Source',
      options: sourceOptions,
      selectedValues: filters.sources,
      onChange: (v: string[]) => set('sources', v),
    },
  ];

  const segmentSection = [
    {
      title: 'Customer Segment',
      options: segmentOptions,
      selectedValues: filters.segments,
      onChange: (v: string[]) => set('segments', v),
    },
  ];

  const clearDates = () => onFiltersChange({ ...filters, dateFrom: undefined, dateTo: undefined });

  const hasMore =
    !!filters.pricingModes.length ||
    !!filters.slaBuckets.length ||
    !!filters.customerTraits.length ||
    !!filters.itemBuckets.length ||
    !!filters.dateFrom ||
    !!filters.dateTo;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customer, contact, lead, phone..."
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <LeadFilterPopover label="Source" sections={sourceSection} />
          <LeadFilterPopover label="Segment" sections={segmentSection} />

          <Select value={filters.sortBy} onValueChange={(v) => set('sortBy', v as SptSortOption)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(isManager || isAdmin) && visibleUsers && visibleUsers.length > 0 && (
            <Select value={filters.assignedTo} onValueChange={(v) => set('assignedTo', v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team</SelectItem>
                {visibleUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant={moreOpen || hasMore ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMoreOpen((v) => !v)}
            className="h-10"
          >
            <SlidersHorizontal className="h-4 w-4 mr-1.5" />
            More filters
          </Button>
        </div>
      </div>

      {moreOpen && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-md border bg-muted/30">
          {moreSections.map((s) => (
            <LeadFilterPopover key={s.title} label={s.title} sections={[s]} />
          ))}

          <span className="text-xs text-muted-foreground ml-2">Handoff Date:</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'w-[130px] justify-start text-left font-normal h-9',
                  !filters.dateFrom && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yy') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateFrom}
                onSelect={(d) => set('dateFrom', d)}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>

          <span className="text-xs text-muted-foreground">to</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'w-[130px] justify-start text-left font-normal h-9',
                  !filters.dateTo && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateTo ? format(filters.dateTo, 'dd/MM/yy') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateTo}
                onSelect={(d) => set('dateTo', d)}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>

          {(filters.dateFrom || filters.dateTo) && (
            <Button variant="ghost" size="sm" onClick={clearDates} className="h-8 px-2">
              <X className="h-4 w-4 mr-1" />
              Clear dates
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------- helpers ----------------

import type { SptInboxLead } from '@/hooks/useSptInbox';
import { slaStatus } from '@/hooks/useSptInbox';

export function applySptFilters(leads: SptInboxLead[], f: SptFiltersState): SptInboxLead[] {
  let out = leads;

  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    out = out.filter((l) => {
      const c = l.customer;
      return (
        l.title?.toLowerCase().includes(q) ||
        c?.company_name?.toLowerCase().includes(q) ||
        c?.contact_person?.toLowerCase().includes(q) ||
        c?.phone?.toLowerCase().includes(q) ||
        c?.email?.toLowerCase().includes(q)
      );
    });
  }

  if (f.sources.length) out = out.filter((l) => f.sources.includes(l.source));
  if (f.segments.length) {
    out = out.filter((l) => l.customer?.segment && f.segments.includes(l.customer.segment));
  }
  if (f.pricingModes.length) out = out.filter((l) => f.pricingModes.includes(l.pricing_summary.mode));

  if (f.slaBuckets.length) {
    out = out.filter((l) => f.slaBuckets.includes(slaStatus(l.hours_since_handoff)));
  }

  if (f.customerTraits.length) {
    out = out.filter((l) => {
      if (f.customerTraits.includes('has_phone') && !l.customer?.phone) return false;
      if (f.customerTraits.includes('has_email') && !l.customer?.email) return false;
      return true;
    });
  }

  if (f.itemBuckets.length) {
    out = out.filter((l) => {
      const n = l.item_count;
      if (f.itemBuckets.includes('1') && n === 1) return true;
      if (f.itemBuckets.includes('2-5') && n >= 2 && n <= 5) return true;
      if (f.itemBuckets.includes('6+') && n >= 6) return true;
      return false;
    });
  }

  if (f.dateFrom) {
    const from = new Date(f.dateFrom); from.setHours(0, 0, 0, 0);
    out = out.filter((l) => new Date(l.handoff_at) >= from);
  }
  if (f.dateTo) {
    const to = new Date(f.dateTo); to.setHours(23, 59, 59, 999);
    out = out.filter((l) => new Date(l.handoff_at) <= to);
  }

  if (f.assignedTo !== 'all') {
    out = out.filter((l) => l.assigned_to === f.assignedTo);
  }

  const sorted = [...out];
  switch (f.sortBy) {
    case 'oldest_handoff':
      sorted.sort((a, b) => new Date(a.handoff_at).getTime() - new Date(b.handoff_at).getTime());
      break;
    case 'most_overdue':
      sorted.sort((a, b) => b.hours_since_handoff - a.hours_since_handoff);
      break;
    case 'highest_value':
      sorted.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      break;
    case 'highest_qty':
      sorted.sort((a, b) => b.total_qty - a.total_qty);
      break;
    case 'customer_az':
      sorted.sort((a, b) =>
        (a.customer?.company_name || a.title || '').localeCompare(b.customer?.company_name || b.title || '')
      );
      break;
    case 'newest_handoff':
    default:
      sorted.sort((a, b) => new Date(b.handoff_at).getTime() - new Date(a.handoff_at).getTime());
  }
  return sorted;
}

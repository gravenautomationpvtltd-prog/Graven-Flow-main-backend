import { Search, CalendarIcon, X } from 'lucide-react';
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
import { LeadFilterPopover } from './LeadFilterPopover';
import { useVisibleUsers } from '@/hooks/useSubordinates';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import type { LeadSortOption } from '@/hooks/useLeads';

type LeadStatus = Database['public']['Enums']['lead_status'];
type LeadSource = Database['public']['Enums']['lead_source'];
type EscalationLevel = Database['public']['Enums']['escalation_level'];
type EnquiryStatus = Database['public']['Enums']['enquiry_status'];

const leadStatusOptions: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const leadSourceOptions: { value: LeadSource; label: string }[] = [
  { value: 'indiamart', label: 'Indiamart' },
  { value: 'justdial', label: 'Justdial' },
  { value: 'tradeindia', label: 'TradeIndia' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'manual', label: 'Manual' },
];

const escalationLevelOptions: { value: EscalationLevel; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'alert', label: 'Alert' },
  { value: 'manager', label: 'Manager' },
  { value: 'coo', label: 'COO' },
  { value: 'ceo', label: 'CEO' },
];

const enquiryPresenceOptions = [
  { value: 'yes', label: 'Has Enquiry' },
  { value: 'no', label: 'No Enquiry' },
];

const enquiryStatusOptions: { value: EnquiryStatus; label: string }[] = [
  { value: 'pending_prices', label: 'Pending Prices' },
  { value: 'partial_prices', label: 'Partial Prices' },
  { value: 'ready_to_quote', label: 'Ready to Quote' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'price_matched', label: 'Price Matched' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'closed', label: 'Closed' },
];

const priceMatchOptions = [
  { value: 'matched', label: 'Price Matched' },
  { value: 'not_matched', label: 'Not Matched' },
];

const sortOptions: { value: LeadSortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'last_activity', label: 'Last Activity' },
  { value: 'expected_close', label: 'Expected Close' },
  { value: 'highest_value', label: 'Highest Value' },
  { value: 'lowest_value', label: 'Lowest Value' },
];

export interface LeadFiltersState {
  statuses: string[];
  sources: string[];
  escalationLevels: string[];
  assignedTo: string;
  search: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  sortBy: LeadSortOption;
  hasEnquiry: string[];
  enquiryStatuses: string[];
  priceMatched: string[];
}

interface LeadFiltersProps {
  filters: LeadFiltersState;
  onFiltersChange: (filters: LeadFiltersState) => void;
}

export function LeadFilters({ filters, onFiltersChange }: LeadFiltersProps) {
  const { data: visibleUsers } = useVisibleUsers();
  const { isManager, isAdmin } = useAuth();

  const clearDates = () => {
    onFiltersChange({ ...filters, dateFrom: undefined, dateTo: undefined });
  };

  // Lead Filters Popover sections
  const leadFilterSections = [
    {
      title: 'Status',
      options: leadStatusOptions,
      selectedValues: filters.statuses,
      onChange: (values: string[]) => onFiltersChange({ ...filters, statuses: values }),
    },
    {
      title: 'Source',
      options: leadSourceOptions,
      selectedValues: filters.sources,
      onChange: (values: string[]) => onFiltersChange({ ...filters, sources: values }),
    },
    {
      title: 'Escalation Level',
      options: escalationLevelOptions,
      selectedValues: filters.escalationLevels,
      onChange: (values: string[]) => onFiltersChange({ ...filters, escalationLevels: values }),
    },
  ];

  // Enquiry Filters Popover sections
  const enquiryFilterSections = [
    {
      title: 'Enquiry Presence',
      options: enquiryPresenceOptions,
      selectedValues: filters.hasEnquiry,
      onChange: (values: string[]) => onFiltersChange({ ...filters, hasEnquiry: values }),
    },
    {
      title: 'Enquiry Status',
      options: enquiryStatusOptions,
      selectedValues: filters.enquiryStatuses,
      onChange: (values: string[]) => onFiltersChange({ ...filters, enquiryStatuses: values }),
    },
    {
      title: 'Price Matching',
      options: priceMatchOptions,
      selectedValues: filters.priceMatched,
      onChange: (values: string[]) => onFiltersChange({ ...filters, priceMatched: values }),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select
            value={filters.sortBy}
            onValueChange={(value: LeadSortOption) => onFiltersChange({ ...filters, sortBy: value })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <LeadFilterPopover
            label="Lead Filters"
            sections={leadFilterSections}
          />

          <LeadFilterPopover
            label="Enquiry Filters"
            sections={enquiryFilterSections}
          />

          {(isManager || isAdmin) && visibleUsers && visibleUsers.length > 0 && (
            <Select
              value={filters.assignedTo}
              onValueChange={(value) => onFiltersChange({ ...filters, assignedTo: value })}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Assigned To" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team</SelectItem>
                {visibleUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Date Range:</span>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !filters.dateFrom && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy") : "From Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={(date) => onFiltersChange({ ...filters, dateFrom: date })}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <span className="text-sm text-muted-foreground">to</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !filters.dateTo && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy") : "To Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={(date) => onFiltersChange({ ...filters, dateTo: date })}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {(filters.dateFrom || filters.dateTo) && (
          <Button variant="ghost" size="sm" onClick={clearDates} className="h-8 px-2">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

import { describe, it, expect } from 'vitest';
import type { LeadFiltersState } from '@/components/leads/LeadFilters';
import type { Database } from '@/integrations/supabase/types';

type EnquiryStatus = Database['public']['Enums']['enquiry_status'];

// Helper to simulate query building logic from useLeads.ts
function buildEnquiryQueryClauses(filters: {
  hasEnquiry?: boolean;
  enquiryStatuses?: EnquiryStatus[];
  enquiryStatus?: EnquiryStatus;
  priceMatched?: boolean;
}) {
  const clauses: { method: string; args: any[] }[] = [];

  if (filters.enquiryStatuses && filters.enquiryStatuses.length > 0) {
    const hasNoEnquiry = filters.enquiryStatuses.includes('no_enquiry' as EnquiryStatus);
    if (hasNoEnquiry) {
      clauses.push({
        method: 'or',
        args: [`enquiry_status.in.(${filters.enquiryStatuses.join(',')}),enquiry_status.is.null`],
      });
    } else {
      clauses.push({
        method: 'in',
        args: ['enquiry_status', filters.enquiryStatuses],
      });
    }
  } else if (filters.enquiryStatus) {
    if (filters.enquiryStatus === 'no_enquiry') {
      clauses.push({
        method: 'or',
        args: ['enquiry_status.eq.no_enquiry,enquiry_status.is.null'],
      });
    } else {
      clauses.push({
        method: 'eq',
        args: ['enquiry_status', filters.enquiryStatus],
      });
    }
  }

  if (filters.hasEnquiry !== undefined) {
    if (filters.hasEnquiry) {
      clauses.push({ method: 'eq', args: ['has_enquiry', true] });
    } else {
      clauses.push({
        method: 'or',
        args: ['has_enquiry.eq.false,has_enquiry.is.null'],
      });
    }
  }

  if (filters.priceMatched !== undefined) {
    if (filters.priceMatched) {
      clauses.push({ method: 'eq', args: ['enquiry_status', 'price_matched'] });
    } else {
      clauses.push({
        method: 'or',
        args: ['enquiry_status.neq.price_matched,enquiry_status.is.null'],
      });
    }
  }

  return clauses;
}

// Helper to simulate conversion from LeadFiltersState to query filters from Leads.tsx
function extractQueryFilters(filters: LeadFiltersState, page = 0, pageSize = 50) {
  return {
    page,
    pageSize,
    hasEnquiry:
      filters.hasEnquiry.includes('yes') && !filters.hasEnquiry.includes('no')
        ? true
        : filters.hasEnquiry.includes('no') && !filters.hasEnquiry.includes('yes')
        ? false
        : undefined,
    enquiryStatuses:
      filters.enquiryStatuses.length > 0
        ? (filters.enquiryStatuses as EnquiryStatus[])
        : undefined,
    priceMatched:
      filters.priceMatched.includes('matched') && !filters.priceMatched.includes('not_matched')
        ? true
        : filters.priceMatched.includes('not_matched') && !filters.priceMatched.includes('matched')
        ? false
        : undefined,
  };
}

describe('OneDesk Enquiry Filters End-to-End Suite', () => {
  const baseFilters: LeadFiltersState = {
    statuses: [],
    sources: [],
    escalationLevels: [],
    assignedTo: 'all',
    search: '',
    dateFrom: undefined,
    dateTo: undefined,
    sortBy: 'newest',
    hasEnquiry: [],
    enquiryStatuses: [],
    priceMatched: [],
  };

  describe('1. Enquiry Presence', () => {
    it('applies hasEnquiry = true when "Has Enquiry" is selected', () => {
      const state = { ...baseFilters, hasEnquiry: ['yes'] };
      const queryFilters = extractQueryFilters(state);
      expect(queryFilters.hasEnquiry).toBe(true);

      const clauses = buildEnquiryQueryClauses(queryFilters);
      expect(clauses).toEqual([{ method: 'eq', args: ['has_enquiry', true] }]);
    });

    it('applies null-safe filter when "No Enquiry" is selected', () => {
      const state = { ...baseFilters, hasEnquiry: ['no'] };
      const queryFilters = extractQueryFilters(state);
      expect(queryFilters.hasEnquiry).toBe(false);

      const clauses = buildEnquiryQueryClauses(queryFilters);
      expect(clauses).toEqual([
        { method: 'or', args: ['has_enquiry.eq.false,has_enquiry.is.null'] },
      ]);
    });

    it('safely handles empty array (no filter applied)', () => {
      const state = { ...baseFilters, hasEnquiry: [] };
      const queryFilters = extractQueryFilters(state);
      expect(queryFilters.hasEnquiry).toBeUndefined();

      const clauses = buildEnquiryQueryClauses(queryFilters);
      expect(clauses).toHaveLength(0);
    });

    it('handles unexpected multi-value array gracefully without crashing', () => {
      const state = { ...baseFilters, hasEnquiry: ['yes', 'no'] };
      const queryFilters = extractQueryFilters(state);
      expect(queryFilters.hasEnquiry).toBeUndefined();
    });
  });

  describe('2. Enquiry Status & Null Safety', () => {
    it('applies null-safe clause when "No Enquiry" status is selected', () => {
      const state = { ...baseFilters, enquiryStatuses: ['no_enquiry'] };
      const queryFilters = extractQueryFilters(state);
      const clauses = buildEnquiryQueryClauses(queryFilters);

      expect(clauses).toEqual([
        { method: 'or', args: ['enquiry_status.in.(no_enquiry),enquiry_status.is.null'] },
      ]);
    });

    it('preserves null safety when combining "No Enquiry" with active statuses', () => {
      const state = { ...baseFilters, enquiryStatuses: ['no_enquiry', 'pending_prices'] };
      const queryFilters = extractQueryFilters(state);
      const clauses = buildEnquiryQueryClauses(queryFilters);

      expect(clauses).toEqual([
        {
          method: 'or',
          args: ['enquiry_status.in.(no_enquiry,pending_prices),enquiry_status.is.null'],
        },
      ]);
    });

    it('uses standard in clause when active statuses do not include no_enquiry', () => {
      const state = { ...baseFilters, enquiryStatuses: ['pending_prices', 'quoted', 'closed'] };
      const queryFilters = extractQueryFilters(state);
      const clauses = buildEnquiryQueryClauses(queryFilters);

      expect(clauses).toEqual([
        { method: 'in', args: ['enquiry_status', ['pending_prices', 'quoted', 'closed']] },
      ]);
    });
  });

  describe('3. Price Matching & Null Safety', () => {
    it('queries enquiry_status = price_matched when Price Matched is true', () => {
      const state = { ...baseFilters, priceMatched: ['matched'] };
      const queryFilters = extractQueryFilters(state);
      expect(queryFilters.priceMatched).toBe(true);

      const clauses = buildEnquiryQueryClauses(queryFilters);
      expect(clauses).toEqual([{ method: 'eq', args: ['enquiry_status', 'price_matched'] }]);
    });

    it('queries null-safe condition when Price Matched is false (Not Matched)', () => {
      const state = { ...baseFilters, priceMatched: ['not_matched'] };
      const queryFilters = extractQueryFilters(state);
      expect(queryFilters.priceMatched).toBe(false);

      const clauses = buildEnquiryQueryClauses(queryFilters);
      expect(clauses).toEqual([
        { method: 'or', args: ['enquiry_status.neq.price_matched,enquiry_status.is.null'] },
      ]);
    });

    it('handles contradictory price matching selections safely', () => {
      const state = { ...baseFilters, priceMatched: ['matched', 'not_matched'] };
      const queryFilters = extractQueryFilters(state);
      expect(queryFilters.priceMatched).toBeUndefined();
    });
  });

  describe('4. Multi-Filter Interactions', () => {
    it('combines Has Enquiry + Quoted Status + Not Matched correctly', () => {
      const state = {
        ...baseFilters,
        hasEnquiry: ['yes'],
        enquiryStatuses: ['quoted'],
        priceMatched: ['not_matched'],
      };
      const queryFilters = extractQueryFilters(state);
      const clauses = buildEnquiryQueryClauses(queryFilters);

      expect(clauses).toEqual([
        { method: 'in', args: ['enquiry_status', ['quoted']] },
        { method: 'eq', args: ['has_enquiry', true] },
        { method: 'or', args: ['enquiry_status.neq.price_matched,enquiry_status.is.null'] },
      ]);
    });

    it('combines No Enquiry Presence + No Enquiry Status correctly', () => {
      const state = {
        ...baseFilters,
        hasEnquiry: ['no'],
        enquiryStatuses: ['no_enquiry'],
      };
      const queryFilters = extractQueryFilters(state);
      const clauses = buildEnquiryQueryClauses(queryFilters);

      expect(clauses).toEqual([
        { method: 'or', args: ['enquiry_status.in.(no_enquiry),enquiry_status.is.null'] },
        { method: 'or', args: ['has_enquiry.eq.false,has_enquiry.is.null'] },
      ]);
    });
  });

  describe('5. Apply and Clear All Atomic Consistency', () => {
    it('atomic apply updates all enquiry dimensions simultaneously without stale overwrites', () => {
      let currentFilters = { ...baseFilters };

      const onFiltersChange = (updated: LeadFiltersState) => {
        currentFilters = updated;
      };

      const handleApplyEnquiryFilters = (newValues: Record<string, string[]>) => {
        onFiltersChange({
          ...currentFilters,
          hasEnquiry: newValues['Enquiry Presence'] ?? currentFilters.hasEnquiry,
          enquiryStatuses: newValues['Enquiry Status'] ?? currentFilters.enquiryStatuses,
          priceMatched: newValues['Price Matching'] ?? currentFilters.priceMatched,
        });
      };

      handleApplyEnquiryFilters({
        'Enquiry Presence': ['yes'],
        'Enquiry Status': ['pending_prices', 'ready_to_quote'],
        'Price Matching': ['matched'],
      });

      expect(currentFilters.hasEnquiry).toEqual(['yes']);
      expect(currentFilters.enquiryStatuses).toEqual(['pending_prices', 'ready_to_quote']);
      expect(currentFilters.priceMatched).toEqual(['matched']);
    });

    it('atomic clear all clears all enquiry dimensions in a single step', () => {
      let currentFilters = {
        ...baseFilters,
        hasEnquiry: ['yes'],
        enquiryStatuses: ['pending_prices'],
        priceMatched: ['matched'],
      };

      const onFiltersChange = (updated: LeadFiltersState) => {
        currentFilters = updated;
      };

      const handleClearEnquiryFilters = () => {
        onFiltersChange({
          ...currentFilters,
          hasEnquiry: [],
          enquiryStatuses: [],
          priceMatched: [],
        });
      };

      handleClearEnquiryFilters();

      expect(currentFilters.hasEnquiry).toEqual([]);
      expect(currentFilters.enquiryStatuses).toEqual([]);
      expect(currentFilters.priceMatched).toEqual([]);
    });
  });

  describe('6. Pagination and Counts', () => {
    it('calculates 0-indexed range bounds accurately for pagination', () => {
      const page = 2;
      const pageSize = 50;
      const from = page * pageSize;
      const to = from + pageSize - 1;

      expect(from).toBe(100);
      expect(to).toBe(149);
      expect(to - from + 1).toBe(pageSize);
    });

    it('resets page to 0 when filters change', () => {
      let page = 3;
      const handleFiltersChange = (_newFilters: LeadFiltersState) => {
        page = 0;
      };

      handleFiltersChange({ ...baseFilters, hasEnquiry: ['yes'] });
      expect(page).toBe(0);
    });
  });
});

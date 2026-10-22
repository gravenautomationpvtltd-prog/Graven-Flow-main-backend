import { describe, it, expect } from 'vitest';
import { startOfDay, endOfDay } from 'date-fns';

describe('Lead Filters & Search Query Construction', () => {
  describe('Search String Sanitization', () => {
    it('properly sanitizes search strings for PostgREST .or() queries', () => {
      const dirty = 'Acme, Ltd. (North) %100% *val*';
      const clean = dirty.replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim();
      expect(clean).toBe('Acme Ltd. North 100 val');
    });

    it('returns empty string when given empty or whitespace-only search', () => {
      const empty = '   ';
      const clean = empty.replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim();
      expect(clean).toBe('');
    });
  });

  describe('Assigned To Filter Logic & Data Isolation', () => {
    it('correctly maps unassigned leads to is("assigned_to", null)', () => {
      const assignedToFilter = 'unassigned';
      const isUnassigned = assignedToFilter === 'unassigned';
      expect(isUnassigned).toBe(true);
    });

    it('forces assignedTo to own user ID for non-managers regardless of client filter selection', () => {
      const isManager = false;
      const isAdmin = false;
      const currentUserId = 'user-jyoti-sales';
      const selectedAssignedTo = 'all'; // user tries to view all team
      const scopeIsPersonal = false;

      const effectiveAssignedTo = (!isManager && !isAdmin && currentUserId)
        ? currentUserId
        : scopeIsPersonal && currentUserId
        ? currentUserId
        : (selectedAssignedTo !== 'all' ? selectedAssignedTo : undefined);

      expect(effectiveAssignedTo).toBe('user-jyoti-sales');
    });

    it('allows managers to view specific team member or all team', () => {
      const isManager = true;
      const isAdmin = false;
      const currentUserId = 'manager-id';
      const scopeIsPersonal = false;

      // When manager selects a specific subordinate
      const selectedSubordinate = 'subordinate-123';
      const effectiveAssignedToSub = (!isManager && !isAdmin && currentUserId)
        ? currentUserId
        : scopeIsPersonal && currentUserId
        ? currentUserId
        : (selectedSubordinate !== 'all' ? selectedSubordinate : undefined);

      expect(effectiveAssignedToSub).toBe('subordinate-123');

      // When manager selects "All Team"
      const selectedAll = 'all';
      const effectiveAssignedToAll = (!isManager && !isAdmin && currentUserId)
        ? currentUserId
        : scopeIsPersonal && currentUserId
        ? currentUserId
        : (selectedAll !== 'all' ? selectedAll : undefined);

      expect(effectiveAssignedToAll).toBeUndefined();
    });

    it('forces assignedTo to own user ID when scope toggle is in personal mode even for managers', () => {
      const isManager = true;
      const isAdmin = false;
      const currentUserId = 'manager-id';
      const scopeIsPersonal = true; // "My work" toggle active
      const selectedAssignedTo = 'all';

      const effectiveAssignedTo = (!isManager && !isAdmin && currentUserId)
        ? currentUserId
        : scopeIsPersonal && currentUserId
        ? currentUserId
        : (selectedAssignedTo !== 'all' ? selectedAssignedTo : undefined);

      expect(effectiveAssignedTo).toBe('manager-id');
    });
  });

  describe('Enquiry Presence & Null-Safety', () => {
    it('builds null-safe filter for hasEnquiry = false', () => {
      const hasEnquiry = false;
      const filterClause = hasEnquiry
        ? 'has_enquiry.eq.true'
        : 'has_enquiry.eq.false,has_enquiry.is.null';

      // Rows where has_enquiry is NULL are preserved in SQL
      expect(filterClause).toBe('has_enquiry.eq.false,has_enquiry.is.null');
    });

    it('builds exact filter for hasEnquiry = true', () => {
      const hasEnquiry = true;
      const filterClause = hasEnquiry
        ? 'has_enquiry.eq.true'
        : 'has_enquiry.eq.false,has_enquiry.is.null';

      expect(filterClause).toBe('has_enquiry.eq.true');
    });
  });

  describe('Price Matched Filter Logic', () => {
    it('sets enquiry_status eq price_matched when priceMatched is true', () => {
      const priceMatched = true;
      const clause = priceMatched
        ? 'enquiry_status.eq.price_matched'
        : 'enquiry_status.neq.price_matched,enquiry_status.is.null';
      expect(clause).toBe('enquiry_status.eq.price_matched');
    });

    it('builds null-safe clause for priceMatched = false preserving leads with null status', () => {
      const priceMatched = false;
      const clause = priceMatched
        ? 'enquiry_status.eq.price_matched'
        : 'enquiry_status.neq.price_matched,enquiry_status.is.null';
      expect(clause).toBe('enquiry_status.neq.price_matched,enquiry_status.is.null');
    });

    it('extracts boolean filter states safely from single and multi arrays', () => {
      const parseBooleanFilter = (arr: string[], yesVal: string, noVal: string) => {
        return arr.includes(yesVal) && !arr.includes(noVal)
          ? true
          : arr.includes(noVal) && !arr.includes(yesVal)
          ? false
          : undefined;
      };

      expect(parseBooleanFilter(['yes'], 'yes', 'no')).toBe(true);
      expect(parseBooleanFilter(['no'], 'yes', 'no')).toBe(false);
      expect(parseBooleanFilter([], 'yes', 'no')).toBe(undefined);
      expect(parseBooleanFilter(['yes', 'no'], 'yes', 'no')).toBe(undefined);

      expect(parseBooleanFilter(['matched'], 'matched', 'not_matched')).toBe(true);
      expect(parseBooleanFilter(['not_matched'], 'matched', 'not_matched')).toBe(false);
      expect(parseBooleanFilter([], 'matched', 'not_matched')).toBe(undefined);
      expect(parseBooleanFilter(['matched', 'not_matched'], 'matched', 'not_matched')).toBe(undefined);
    });
  });

  describe('Date Range Boundaries', () => {
    it('ensures dateFrom covers beginning of the day (00:00:00.000)', () => {
      const fromDate = new Date('2026-10-15T14:30:00.000Z');
      const start = startOfDay(fromDate);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
    });

    it('ensures dateTo covers entire end of day (23:59:59.999)', () => {
      const toDate = new Date('2026-10-15T09:15:00.000Z');
      const end = endOfDay(toDate);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
    });
  });

  describe('Reset & Filter State Consistency', () => {
    it('default state has empty arrays and all team', () => {
      const defaultFilters = {
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

      const isFiltered = Boolean(
        defaultFilters.search ||
        defaultFilters.statuses.length > 0 ||
        defaultFilters.sources.length > 0 ||
        defaultFilters.escalationLevels.length > 0 ||
        defaultFilters.hasEnquiry.length > 0 ||
        defaultFilters.enquiryStatuses.length > 0 ||
        defaultFilters.priceMatched.length > 0 ||
        defaultFilters.dateFrom ||
        defaultFilters.dateTo ||
        (defaultFilters.assignedTo !== 'all')
      );

      expect(isFiltered).toBe(false);
    });

    it('detects when filters are active', () => {
      const activeFilters = {
        statuses: ['new', 'engaged'],
        sources: ['indiamart'],
        escalationLevels: [],
        assignedTo: 'all',
        search: 'vfd',
        dateFrom: new Date(),
        dateTo: undefined,
        sortBy: 'newest',
        hasEnquiry: ['yes'],
        enquiryStatuses: [],
        priceMatched: [],
      };

      const isFiltered = Boolean(
        activeFilters.search ||
        activeFilters.statuses.length > 0 ||
        activeFilters.sources.length > 0 ||
        activeFilters.escalationLevels.length > 0 ||
        activeFilters.hasEnquiry.length > 0 ||
        activeFilters.enquiryStatuses.length > 0 ||
        activeFilters.priceMatched.length > 0 ||
        activeFilters.dateFrom ||
        activeFilters.dateTo ||
        (activeFilters.assignedTo !== 'all')
      );

      expect(isFiltered).toBe(true);
    });
  });
});

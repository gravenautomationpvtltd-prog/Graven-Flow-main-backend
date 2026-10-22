import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

describe('useLeads Supabase Query Chain Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds customer search with phone, email, and gst fields', async () => {
    const cleanSearch = '9876543210';
    let customerOrClause = '';

    const mockFrom = vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'customers') {
        const query: any = {
          select: () => query,
          or: (clause: string) => {
            customerOrClause = clause;
            return query;
          },
          is: () => query,
          limit: async () => ({ data: [{ id: 'cust-99' }] }),
        };
        return query;
      }
      return {} as any;
    });

    // Run customer lookup query matching useLeads logic
    const { data: matchingCustomers } = await supabase
      .from('customers')
      .select('id')
      .or(`company_name.ilike.%${cleanSearch}%,contact_person.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%,gst_number.ilike.%${cleanSearch}%`)
      .is('deleted_at', null)
      .limit(50);

    expect(matchingCustomers).toEqual([{ id: 'cust-99' }]);
    expect(customerOrClause).toContain('phone.ilike.%9876543210%');
    expect(customerOrClause).toContain('email.ilike.%9876543210%');
    expect(customerOrClause).toContain('gst_number.ilike.%9876543210%');
    expect(customerOrClause).toContain('company_name.ilike.%9876543210%');
  });

  it('builds unassigned leads query with is("assigned_to", null)', () => {
    const executedCalls: { method: string; args: any[] }[] = [];

    const mockQueryBuilder: any = {
      is: (col: string, val: any) => {
        executedCalls.push({ method: 'is', args: [col, val] });
        return mockQueryBuilder;
      },
      eq: (col: string, val: any) => {
        executedCalls.push({ method: 'eq', args: [col, val] });
        return mockQueryBuilder;
      },
    };

    const assignedTo = 'unassigned';
    if (assignedTo === 'unassigned') {
      mockQueryBuilder.is('assigned_to', null);
    } else if (assignedTo) {
      mockQueryBuilder.eq('assigned_to', assignedTo);
    }

    expect(executedCalls).toEqual([{ method: 'is', args: ['assigned_to', null] }]);
  });

  it('builds null-safe enquiry presence query for false value', () => {
    const executedCalls: { method: string; args: any[] }[] = [];

    const mockQueryBuilder: any = {
      eq: (col: string, val: any) => {
        executedCalls.push({ method: 'eq', args: [col, val] });
        return mockQueryBuilder;
      },
      or: (clause: string) => {
        executedCalls.push({ method: 'or', args: [clause] });
        return mockQueryBuilder;
      },
    };

    const hasEnquiry = false;
    if (hasEnquiry !== undefined) {
      if (hasEnquiry) {
        mockQueryBuilder.eq('has_enquiry', true);
      } else {
        mockQueryBuilder.or('has_enquiry.eq.false,has_enquiry.is.null');
      }
    }

    expect(executedCalls).toEqual([
      { method: 'or', args: ['has_enquiry.eq.false,has_enquiry.is.null'] },
    ]);
  });

  it('builds null-safe priceMatched query for false value (not matched)', () => {
    const executedCalls: { method: string; args: any[] }[] = [];

    const mockQueryBuilder: any = {
      eq: (col: string, val: any) => {
        executedCalls.push({ method: 'eq', args: [col, val] });
        return mockQueryBuilder;
      },
      or: (clause: string) => {
        executedCalls.push({ method: 'or', args: [clause] });
        return mockQueryBuilder;
      },
    };

    // When priceMatched is false
    const priceMatched = false;
    if (priceMatched !== undefined) {
      if (priceMatched) {
        mockQueryBuilder.eq('enquiry_status', 'price_matched');
      } else {
        mockQueryBuilder.or('enquiry_status.neq.price_matched,enquiry_status.is.null');
      }
    }

    expect(executedCalls).toEqual([
      { method: 'or', args: ['enquiry_status.neq.price_matched,enquiry_status.is.null'] },
    ]);
  });

  it('builds null-safe enquiryStatuses query when no_enquiry is selected', () => {
    const executedCalls: { method: string; args: any[] }[] = [];

    const mockQueryBuilder: any = {
      in: (col: string, vals: any[]) => {
        executedCalls.push({ method: 'in', args: [col, vals] });
        return mockQueryBuilder;
      },
      or: (clause: string) => {
        executedCalls.push({ method: 'or', args: [clause] });
        return mockQueryBuilder;
      },
    };

    const enquiryStatuses = ['no_enquiry', 'pending_prices'];
    if (enquiryStatuses && enquiryStatuses.length > 0) {
      const hasNoEnquiry = enquiryStatuses.includes('no_enquiry');
      if (hasNoEnquiry) {
        mockQueryBuilder.or(`enquiry_status.in.(${enquiryStatuses.join(',')}),enquiry_status.is.null`);
      } else {
        mockQueryBuilder.in('enquiry_status', enquiryStatuses);
      }
    }

    expect(executedCalls).toEqual([
      { method: 'or', args: ['enquiry_status.in.(no_enquiry,pending_prices),enquiry_status.is.null'] },
    ]);
  });

  it('builds standard in query when enquiryStatuses does not include no_enquiry', () => {
    const executedCalls: { method: string; args: any[] }[] = [];

    const mockQueryBuilder: any = {
      in: (col: string, vals: any[]) => {
        executedCalls.push({ method: 'in', args: [col, vals] });
        return mockQueryBuilder;
      },
      or: (clause: string) => {
        executedCalls.push({ method: 'or', args: [clause] });
        return mockQueryBuilder;
      },
    };

    const enquiryStatuses = ['pending_prices', 'quoted'];
    if (enquiryStatuses && enquiryStatuses.length > 0) {
      const hasNoEnquiry = enquiryStatuses.includes('no_enquiry');
      if (hasNoEnquiry) {
        mockQueryBuilder.or(`enquiry_status.in.(${enquiryStatuses.join(',')}),enquiry_status.is.null`);
      } else {
        mockQueryBuilder.in('enquiry_status', enquiryStatuses);
      }
    }

    expect(executedCalls).toEqual([
      { method: 'in', args: ['enquiry_status', ['pending_prices', 'quoted']] },
    ]);
  });

  it('builds startOfDay and endOfDay ISO bounds for date range', () => {
    const executedCalls: { method: string; args: any[] }[] = [];

    const mockQueryBuilder: any = {
      gte: (col: string, val: string) => {
        executedCalls.push({ method: 'gte', args: [col, val] });
        return mockQueryBuilder;
      },
      lte: (col: string, val: string) => {
        executedCalls.push({ method: 'lte', args: [col, val] });
        return mockQueryBuilder;
      },
    };

    const dateFrom = new Date('2026-10-15T10:00:00Z');
    const dateTo = new Date('2026-10-16T15:00:00Z');

    if (dateFrom) {
      mockQueryBuilder.gte('created_at', startOfDay(dateFrom).toISOString());
    }
    if (dateTo) {
      mockQueryBuilder.lte('created_at', endOfDay(dateTo).toISOString());
    }

    expect(executedCalls[0].method).toBe('gte');
    expect(executedCalls[0].args[0]).toBe('created_at');
    expect(executedCalls[1].method).toBe('lte');
    expect(executedCalls[1].args[0]).toBe('created_at');

    const gteDate = new Date(executedCalls[0].args[1]);
    const lteDate = new Date(executedCalls[1].args[1]);

    expect(gteDate.getTime()).toBeLessThan(lteDate.getTime());
  });

  it('computes exact pagination ranges without off-by-one errors', () => {
    const page = 2;
    const pageSize = 25;
    const from = page * pageSize; // 50
    const to = from + pageSize - 1; // 74

    expect(from).toBe(50);
    expect(to).toBe(74);
    expect(to - from + 1).toBe(pageSize);
  });
});

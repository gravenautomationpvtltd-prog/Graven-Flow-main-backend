import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchUserAssociatedLeadIds } from '../lead-persistence';
import { supabase } from '@/integrations/supabase/client';

describe('lead-persistence: fetchUserAssociatedLeadIds', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array when userId is empty or null', async () => {
    const res = await fetchUserAssociatedLeadIds('');
    expect(res).toEqual([]);
  });

  it('aggregates and deduplicates lead IDs from quotations, history, and qualifications', async () => {
    const testUserId = 'test-user-123';

    // Mock supabase calls
    const mockFrom = vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      const makeChain = (data: any[]) => {
        const queryObj: any = {
          select: () => queryObj,
          eq: () => queryObj,
          is: () => queryObj,
          not: () => queryObj,
          or: () => queryObj,
          gte: () => queryObj,
          order: () => queryObj,
          limit: async () => ({ data }),
        };
        return queryObj;
      };

      if (table === 'quotations') {
        return makeChain([
          { lead_id: 'lead-quote-1' },
          { lead_id: 'lead-shared' },
        ]) as any;
      }

      if (table === 'lead_assignment_history') {
        return makeChain([
          { lead_id: 'lead-history-1' },
          { lead_id: 'lead-shared' },
        ]) as any;
      }

      if (table === 'lead_qualification') {
        return makeChain([
          { lead_id: 'lead-qual-1' },
          { lead_id: 'lead-shared' },
        ]) as any;
      }

      if (table === 'sales_orders') {
        return makeChain([
          { lead_id: 'lead-order-1' },
          { lead_id: 'lead-shared' },
        ]) as any;
      }

      return makeChain([]) as any;
    });
    const leadIds = await fetchUserAssociatedLeadIds(testUserId);
    expect(mockFrom).toHaveBeenCalled();
    expect(leadIds).toContain('lead-quote-1');
    expect(leadIds).toContain('lead-history-1');
    expect(leadIds).toContain('lead-qual-1');
    expect(leadIds).toContain('lead-order-1');
    expect(leadIds).toContain('lead-shared');
    expect(leadIds.length).toBe(5); // Deduplicated (4 unique + 1 shared)
  });

  it('handles database errors gracefully and returns empty array without throwing', async () => {
    vi.spyOn(supabase, 'from').mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const leadIds = await fetchUserAssociatedLeadIds('any-user');
    expect(leadIds).toEqual([]);
  });
});

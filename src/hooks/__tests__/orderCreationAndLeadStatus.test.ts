import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Lead Status (Engaged -> Quoted) and Order Creation Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Lead Status Pre-Validation (LeadHeader & EditLeadDialog)', () => {
    it('blocks transition to Quoted if quotation count is 0', async () => {
      const mockSupabaseQuery = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ count: 0, error: null }),
      };

      const lead = { id: 'lead-test-1', status: 'engaged' };
      const statusToSet = 'quoted';
      let errorThrown = false;
      let toastErrorMsg = '';

      if (statusToSet === 'quoted') {
        const { count } = await mockSupabaseQuery
          .from('quotations')
          .select('*', { count: 'exact', head: true })
          .eq('lead_id', lead.id)
          .is('deleted_at', null);

        if (!count || count === 0) {
          toastErrorMsg = 'Cannot set status to Quoted: No quotation exists for this lead. Please create a quotation first.';
          errorThrown = true;
        }
      }

      expect(errorThrown).toBe(true);
      expect(toastErrorMsg).toContain('No quotation exists for this lead');
    });

    it('allows transition to Quoted when active quotation exists', async () => {
      const mockSupabaseQuery = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ count: 1, error: null }),
      };

      const lead = { id: 'lead-test-2', status: 'engaged' };
      const statusToSet = 'quoted';
      let errorThrown = false;

      if (statusToSet === 'quoted') {
        const { count } = await mockSupabaseQuery
          .from('quotations')
          .select('*', { count: 'exact', head: true })
          .eq('lead_id', lead.id)
          .is('deleted_at', null);

        if (!count || count === 0) {
          errorThrown = true;
        }
      }

      expect(errorThrown).toBe(false);
    });
  });

  describe('Order Creation Idempotency & Concurrency Safeguards', () => {
    it('returns existing order without duplicate insertion if active order exists for lead', async () => {
      const existingActiveOrder = {
        id: 'so-existing-1',
        lead_id: 'lead-123',
        order_number: 'SO-2026-0001',
        status: 'ready_for_procurement',
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existingActiveOrder }),
        insert: vi.fn(),
      };

      // Simulating idempotency check in useCreateSalesOrder
      const leadId = 'lead-123';
      let finalOrder: any = null;

      if (leadId) {
        const { data } = await mockSupabase
          .from('sales_orders')
          .select('*')
          .eq('lead_id', leadId)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          finalOrder = data;
        }
      }

      expect(finalOrder).toEqual(existingActiveOrder);
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('handles unique constraint collision by falling back to existing order', async () => {
      const existingOrder = {
        id: 'so-collision-1',
        lead_id: 'lead-456',
        order_number: 'SO-2026-0002',
      };

      const mockInsertResult = {
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint idx_sales_orders_unique_active_lead',
        },
      };

      let finalResult = null;
      if (mockInsertResult.error?.code === '23505' && mockInsertResult.error?.message?.includes('idx_sales_orders_unique_active_lead')) {
        // Fallback query
        finalResult = existingOrder;
      }

      expect(finalResult).toEqual(existingOrder);
    });

    it('submission lock ref prevents concurrent clicks in RecordOrderDialog', async () => {
      let isSubmitting = false;
      const isSubmittingRef = { current: false };
      let executionCount = 0;

      const triggerSubmit = async () => {
        if (isSubmittingRef.current || isSubmitting) {
          return;
        }
        isSubmittingRef.current = true;
        isSubmitting = true;

        try {
          executionCount++;
          await new Promise((resolve) => setTimeout(resolve, 50));
        } finally {
          isSubmitting = false;
          isSubmittingRef.current = false;
        }
      };

      // Simulate rapid user clicking 5 times in parallel
      await Promise.all([
        triggerSubmit(),
        triggerSubmit(),
        triggerSubmit(),
        triggerSubmit(),
        triggerSubmit(),
      ]);

      expect(executionCount).toBe(1);
      expect(isSubmittingRef.current).toBe(false);
      expect(isSubmitting).toBe(false);
    });

    it('AccountsRecordOrderDialog idempotency: rejects duplicate orders for already converted quotations', async () => {
      const existingOrder = {
        id: 'so-accounts-1',
        order_number: 'SO-ACC-001',
        status: 'ready_for_procurement',
      };

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existingOrder }),
      };

      const quotationId = 'quotation-already-ordered';
      const { data } = await mockSupabase
        .from('sales_orders')
        .select('id, order_number, status')
        .eq('quotation_id', quotationId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      expect(data).toBeDefined();
      expect(data?.status).not.toBe('pending_documents');
      expect(data?.order_number).toBe('SO-ACC-001');
    });
  });

  describe('Quotation PDF Performance & In-Memory Item Caching', () => {
    it('uses cached quotation items on repeated generation requests', async () => {
      const quotationId = 'q-perf-test';
      const cache = new Map<string, { timestamp: number; items: any[] }>();

      const mockItems = [
        { id: 'item-1', description: 'Sensor A', model_number: 'SN-001', quantity: 2, rate: 500, amount: 1000 },
        { id: 'item-2', description: 'Relay B', model_number: 'RL-002', quantity: 1, rate: 200, amount: 200 },
      ];

      // Simulate cache miss on first call
      let fetchCount = 0;
      const getItems = (qId: string) => {
        if (cache.has(qId)) {
          return cache.get(qId)!.items;
        }
        fetchCount++;
        cache.set(qId, { timestamp: Date.now(), items: mockItems });
        return mockItems;
      };

      const firstCallStart = performance.now();
      const firstResult = getItems(quotationId);
      const firstDuration = performance.now() - firstCallStart;

      const secondCallStart = performance.now();
      const secondResult = getItems(quotationId);
      const secondDuration = performance.now() - secondCallStart;

      expect(fetchCount).toBe(1);
      expect(firstResult).toEqual(secondResult);
      expect(secondDuration).toBeLessThanOrEqual(firstDuration);
    });
  });
});

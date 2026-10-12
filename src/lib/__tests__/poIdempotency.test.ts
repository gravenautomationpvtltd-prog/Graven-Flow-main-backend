import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPurchaseOrderIdempotent } from '../po-idempotency';
import { supabase } from '@/integrations/supabase/client';

describe('po-idempotency: createPurchaseOrderIdempotent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls create_purchase_order_secure RPC and returns the created PO', async () => {
    const mockPO = {
      id: 'po-123',
      po_number: 'PO-2026-0001',
      supplier_id: 'supp-1',
      status: 'draft',
      total_amount: 1000,
    };

    const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: mockPO,
      error: null,
    } as any);

    const result = await createPurchaseOrderIdempotent({
      supplier_id: 'supp-1',
      items: [
        {
          description: 'Widget A',
          quantity: 10,
          rate: 100,
          tax_percent: 18,
          tax_amount: 180,
          amount: 1000,
        },
      ],
      idempotency_key: 'test-key-1',
    }, 'user-abc');

    expect(rpcSpy).toHaveBeenCalledWith('create_purchase_order_secure', expect.objectContaining({
      payload: expect.objectContaining({
        supplier_id: 'supp-1',
        idempotency_key: 'test-key-1',
        created_by: 'user-abc',
      }),
    }));
    expect(result).toEqual(mockPO);
  });

  it('coalesces concurrent requests with the same idempotency key into a single invocation', async () => {
    const mockPO = {
      id: 'po-coalesce',
      po_number: 'PO-2026-0002',
      supplier_id: 'supp-2',
      status: 'draft',
    };

    let callCount = 0;
    vi.spyOn(supabase, 'rpc').mockImplementation(async () => {
      callCount++;
      // Simulate network latency
      await new Promise(res => setTimeout(res, 20));
      return { data: mockPO, error: null } as any;
    });

    const key = `key-concurrent-${Date.now()}`;
    const [res1, res2, res3] = await Promise.all([
      createPurchaseOrderIdempotent({ supplier_id: 'supp-2', items: [], idempotency_key: key }, 'user-1'),
      createPurchaseOrderIdempotent({ supplier_id: 'supp-2', items: [], idempotency_key: key }, 'user-1'),
      createPurchaseOrderIdempotent({ supplier_id: 'supp-2', items: [], idempotency_key: key }, 'user-1'),
    ]);

    expect(callCount).toBe(1);
    expect(res1).toEqual(mockPO);
    expect(res2).toEqual(mockPO);
    expect(res3).toEqual(mockPO);
  });

  it('reuses cached PO result when re-submitted within the cache window', async () => {
    const mockPO = {
      id: 'po-cached',
      po_number: 'PO-2026-0003',
      supplier_id: 'supp-3',
      status: 'draft',
    };

    let rpcCallCount = 0;
    vi.spyOn(supabase, 'rpc').mockImplementation(async () => {
      rpcCallCount++;
      return { data: mockPO, error: null } as any;
    });

    const key = `key-repeat-${Date.now()}`;
    const firstResult = await createPurchaseOrderIdempotent({
      supplier_id: 'supp-3',
      items: [],
      idempotency_key: key,
    }, 'user-1');

    const secondResult = await createPurchaseOrderIdempotent({
      supplier_id: 'supp-3',
      items: [],
      idempotency_key: key,
    }, 'user-1');

    expect(rpcCallCount).toBe(1);
    expect(firstResult).toEqual(mockPO);
    expect(secondResult).toEqual(mockPO);
  });
});

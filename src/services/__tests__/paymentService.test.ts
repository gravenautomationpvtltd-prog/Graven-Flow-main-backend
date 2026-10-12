import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockPaymentProvider } from '../paymentService';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'payment_requests') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'test-pay-uuid',
                    amount: 1500,
                    purpose: 'Technical Consultation / TST Service',
                    status: 'pending',
                    payment_reference: 'MOCK-PAY-TEST-1234',
                    payment_link: 'http://localhost/payment-status?ref=MOCK-PAY-TEST-1234',
                    is_test_mode: true,
                  },
                  error: null,
                }),
              }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { status: 'paid' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      }),
    },
  };
});

describe('Payment Service Architecture (Modular & Future-Proof for Razorpay)', () => {
  let provider: MockPaymentProvider;

  beforeEach(() => {
    provider = new MockPaymentProvider();
  });

  it('creates payment request with test mode flag and unique reference', async () => {
    const result = await provider.createPayment({
      tenantId: 'tenant-123',
      leadId: 'lead-456',
      customerId: 'cust-789',
      amount: 1500,
      purpose: 'Technical Consultation / TST Service',
    });

    expect(result.id).toBe('test-pay-uuid');
    expect(result.amount).toBe(1500);
    expect(result.isTestMode).toBe(true);
    expect(result.status).toBe('pending');
    expect(result.paymentReference).toContain('MOCK-PAY');
  });

  it('verifies paid status correctly', async () => {
    const isPaid = await provider.verifyPayment('test-pay-uuid');
    expect(isPaid).toBe(true);
  });

  it('supports markAsPaidTestMode without requiring external Razorpay credentials', async () => {
    const success = await provider.markAsPaidTestMode('test-pay-uuid');
    expect(success).toBe(true);
  });
});

import { supabase } from '@/integrations/supabase/client';

export interface PaymentRequestInput {
  tenantId: string;
  leadId?: string;
  customerId?: string;
  amount: number;
  purpose?: string;
  description?: string;
  createdBy?: string;
}

export interface PaymentRequestResult {
  id: string;
  amount: number;
  purpose: string;
  status: 'not_requested' | 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  paymentReference: string;
  paymentLink?: string;
  isTestMode: boolean;
}

/**
 * Payment Provider Interface
 * Designed to allow seamless drop-in of RazorpayPaymentProvider in the future
 * without altering any frontend screens or workflow logic.
 */
export interface PaymentProvider {
  createPayment(input: PaymentRequestInput): Promise<PaymentRequestResult>;
  verifyPayment(paymentRequestId: string): Promise<boolean>;
  markAsPaidTestMode(paymentRequestId: string): Promise<boolean>;
}

/**
 * Mock / Test Mode Payment Provider
 * Controlled testing implementation (no real Razorpay keys required).
 */
export class MockPaymentProvider implements PaymentProvider {
  async createPayment(input: PaymentRequestInput): Promise<PaymentRequestResult> {
    const reference = `MOCK-PAY-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const mockLink = `${window.location.origin}/payment-status?ref=${reference}`;

    const { data, error } = await (supabase as any)
      .from('payment_requests')
      .insert({
        tenant_id: input.tenantId,
        lead_id: input.leadId || null,
        customer_id: input.customerId || null,
        amount: input.amount,
        purpose: input.purpose || 'Technical Consultation / TST Service',
        description: input.description || '',
        status: 'pending',
        payment_reference: reference,
        payment_link: mockLink,
        provider: 'mock',
        is_test_mode: true,
        created_by: input.createdBy || null,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      amount: Number(data.amount),
      purpose: data.purpose,
      status: data.status,
      paymentReference: data.payment_reference,
      paymentLink: data.payment_link,
      isTestMode: data.is_test_mode,
    };
  }

  async verifyPayment(paymentRequestId: string): Promise<boolean> {
    const { data, error } = await (supabase as any)
      .from('payment_requests')
      .select('status')
      .eq('id', paymentRequestId)
      .single();

    if (error) return false;
    return data.status === 'paid';
  }

  async markAsPaidTestMode(paymentRequestId: string): Promise<boolean> {
    const { error } = await (supabase as any)
      .from('payment_requests')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentRequestId);

    if (error) throw error;
    return true;
  }
}

/**
 * Global Payment Service Instance
 * Currently delegates to MockPaymentProvider.
 * In the future:
 * const provider = isProductionRazorpayEnabled ? new RazorpayPaymentProvider() : new MockPaymentProvider();
 */
export const paymentService: PaymentProvider = new MockPaymentProvider();

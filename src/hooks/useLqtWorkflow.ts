import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { paymentService } from '@/services/paymentService';
import { useAuth } from '@/hooks/useAuth';
import { logActivity } from '@/lib/activity-logger';
import { toast } from 'sonner';

export interface SendCustomerFormInput {
  leadId: string;
  customerId?: string;
  prefilledData: {
    customerName?: string;
    companyName?: string;
    phone?: string;
    email?: string;
    city?: string;
    state?: string;
    requirement?: string;
  };
}

export function useLqtWorkflow(leadId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Query payment request for lead
  const paymentRequestQuery = useQuery({
    queryKey: ['payment-request', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await (supabase as any)
        .from('payment_requests')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });

  // Query customer form for lead
  const customerFormQuery = useQuery({
    queryKey: ['customer-form', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await (supabase as any)
        .from('customer_forms')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
  });

  // Mutation: Send Customer Form
  const sendCustomerForm = useMutation({
    mutationFn: async (input: SendCustomerFormInput) => {
      const tenantId = (user as any)?.user_metadata?.tenant_id || '1a5184ef-5138-4327-8928-67bc4f229131';
      const token = `cf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const { data, error } = await (supabase as any)
        .from('customer_forms')
        .insert({
          tenant_id: tenantId,
          lead_id: input.leadId,
          customer_id: input.customerId || null,
          token,
          status: 'sent',
          prefilled_data: input.prefilledData,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      await logActivity({
        action: 'create',
        entityType: 'customer_form',
        entityId: data.id,
        entityName: `Customer Form for ${input.prefilledData.customerName || 'Lead'}`,
        metadata: { leadId: input.leadId, customerId: input.customerId, token },
      });

      return {
        ...data,
        formUrl: `${window.location.origin}/customer-form/${token}`,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-form', leadId] });
      toast.success('Customer Form generated successfully!');
    },
    onError: (err: any) => {
      toast.error(`Failed to generate customer form: ${err.message}`);
    },
  });

  // Mutation: Create Payment Request
  const createPaymentRequest = useMutation({
    mutationFn: async (params: { amount: number; purpose?: string; description?: string; customerId?: string }) => {
      const tenantId = (user as any)?.user_metadata?.tenant_id || '1a5184ef-5138-4327-8928-67bc4f229131';
      const res = await paymentService.createPayment({
        tenantId,
        leadId,
        customerId: params.customerId,
        amount: params.amount,
        purpose: params.purpose,
        description: params.description,
        createdBy: user?.id,
      });

      await logActivity({
        action: 'create',
        entityType: 'payment_request',
        entityId: res.id,
        entityName: `Payment Request: ₹${params.amount} (${params.purpose || 'Technical Consultation'})`,
        metadata: { leadId, amount: params.amount, reference: res.paymentReference },
      });

      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-request', leadId] });
      toast.success('Payment Request created!');
    },
    onError: (err: any) => {
      toast.error(`Failed to create payment request: ${err.message}`);
    },
  });

  // Mutation: Mark Payment Paid (Test Mode)
  const markPaymentPaidTestMode = useMutation({
    mutationFn: async (paymentRequestId: string) => {
      const ok = await paymentService.markAsPaidTestMode(paymentRequestId);

      await logActivity({
        action: 'update',
        entityType: 'payment_request',
        entityId: paymentRequestId,
        entityName: 'Mark Payment as Paid [TEST MODE]',
        metadata: { paymentRequestId, testMode: true },
      });

      return ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-request', leadId] });
      queryClient.invalidateQueries({ queryKey: ['tst-cases'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Payment marked as PAID [TEST MODE]! TST case automatically generated.');
    },
    onError: (err: any) => {
      toast.error(`Failed to mark payment as paid: ${err.message}`);
    },
  });

  // Mutation: Direct Send to TST
  const sendToTST = useMutation({
    mutationFn: async (params: { customerId?: string; title?: string; notes?: string; priority?: string }) => {
      if (!leadId) throw new Error('Lead ID is required');
      const tenantId = (user as any)?.user_metadata?.tenant_id || '1a5184ef-5138-4327-8928-67bc4f229131';

      // Check if existing case already exists
      const { data: existing } = await (supabase as any)
        .from('tst_cases')
        .select('id')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (existing) {
        return existing;
      }

      const { data, error } = await (supabase as any)
        .from('tst_cases')
        .insert({
          tenant_id: tenantId,
          customer_id: params.customerId || null,
          lead_id: leadId,
          title: params.title || 'Direct LQT -> TST Escalation Case',
          description: params.notes || 'Referred directly by LQT team for urgent technical analysis',
          priority: params.priority || 'high',
          status: 'new',
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      await (supabase as any)
        .from('leads')
        .update({ status: 'qualified', updated_at: new Date().toISOString() })
        .eq('id', leadId);

      await logActivity({
        action: 'create',
        entityType: 'tst_case',
        entityId: data.id,
        entityName: `TST Case: ${params.title || 'Technical Consultation'}`,
        metadata: { leadId, customerId: params.customerId, priority: params.priority || 'high' },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tst-cases'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Case successfully forwarded to TST Queue!');
    },
    onError: (err: any) => {
      toast.error(`Failed to forward to TST: ${err.message}`);
    },
  });

  return {
    paymentRequest: paymentRequestQuery.data,
    isPaymentLoading: paymentRequestQuery.isLoading,
    customerForm: customerFormQuery.data,
    isCustomerFormLoading: customerFormQuery.isLoading,
    sendCustomerForm,
    createPaymentRequest,
    markPaymentPaidTestMode,
    sendToTST,
  };
}

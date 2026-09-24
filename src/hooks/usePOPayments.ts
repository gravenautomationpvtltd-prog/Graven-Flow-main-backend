import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface POPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  transaction_reference: string | null;
  bank_name: string | null;
  notes: string | null;
  paid_by: string | null;
  created_at: string;
  paid_by_profile?: {
    id: string;
    full_name: string;
  } | null;
}

export interface POPaymentSummary {
  payments: POPayment[];
  totalPaid: number;
  balance: number;
  isFullyPaid: boolean;
}

export function usePOPayments(poId: string | undefined, grandTotal: number = 0) {
  return useQuery({
    queryKey: ['po-payments', poId],
    queryFn: async (): Promise<POPaymentSummary> => {
      if (!poId) {
        return { payments: [], totalPaid: 0, balance: grandTotal, isFullyPaid: false };
      }

      const { data, error } = await supabase
        .from('supplier_payments')
        .select(`
          id,
          amount,
          payment_date,
          payment_mode,
          transaction_reference,
          bank_name,
          notes,
          paid_by,
          created_at,
          paid_by_profile:profiles!supplier_payments_paid_by_fkey(id, full_name)
        `)
        .eq('po_id', poId)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const payments = (data || []) as POPayment[];
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = grandTotal - totalPaid;

      return {
        payments,
        totalPaid,
        balance,
        isFullyPaid: totalPaid > 0 && balance <= 0,
      };
    },
    enabled: !!poId,
  });
}

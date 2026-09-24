import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PaymentEditInput {
  id: string;
  type: 'received' | 'paid';
  amount: number;
  payment_date: string;
  payment_mode: string;
  transaction_reference?: string | null;
  notes?: string | null;
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['accounts'] });
  qc.invalidateQueries({ queryKey: ['books'] });
  qc.invalidateQueries({ queryKey: ['customer-payments'] });
  qc.invalidateQueries({ queryKey: ['supplier-payments'] });
  qc.invalidateQueries({ queryKey: ['invoices'] });
};

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PaymentEditInput) => {
      const table = input.type === 'received' ? 'customer_payments' : 'supplier_payments';
      const { error } = await supabase
        .from(table)
        .update({
          amount: input.amount,
          payment_date: input.payment_date,
          payment_mode: input.payment_mode as any,
          transaction_reference: input.transaction_reference || null,
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(qc);
      toast.success('Payment updated');
    },
    onError: (e: any) => toast.error(e.message || 'Could not update the payment'),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'received' | 'paid' }) => {
      const table = type === 'received' ? 'customer_payments' : 'supplier_payments';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(qc);
      toast.success('Payment deleted');
    },
    onError: (e: any) => toast.error(e.message || 'Could not delete the payment'),
  });
}

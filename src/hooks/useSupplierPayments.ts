import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  po_id?: string | null;
  amount: number;
  payment_date: string;
  payment_mode: string;
  transaction_reference?: string | null;
  bank_name?: string | null;
  notes?: string | null;
  paid_by?: string | null;
  receipt_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierPaymentWithDetails extends SupplierPayment {
  supplier?: {
    id: string;
    name: string;
  } | null;
  purchase_order?: {
    id: string;
    po_number: string;
  } | null;
  paid_by_profile?: {
    id: string;
    full_name: string;
  } | null;
}

export function useSupplierPayments(supplierId?: string) {
  return useQuery({
    queryKey: ['supplier-payments', supplierId],
    queryFn: async () => {
      let query = supabase
        .from('supplier_payments')
        .select(`
          *,
          supplier:suppliers(id, name),
          purchase_order:purchase_orders(id, po_number),
          paid_by_profile:profiles!supplier_payments_paid_by_fkey(id, full_name)
        `)
        .order('payment_date', { ascending: false });

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SupplierPaymentWithDetails[];
    },
  });
}

export function useCreateSupplierPayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payment: Partial<SupplierPayment>) => {
      const { data, error } = await supabase
        .from('supplier_payments')
        .insert(payment as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Payment recorded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });
}

export function useUpdateSupplierPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payment }: { id: string; payment: Partial<SupplierPayment> }) => {
      const { data, error } = await supabase
        .from('supplier_payments')
        .update(payment)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Payment updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update payment: ${error.message}`);
    },
  });
}

export function useDeleteSupplierPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('supplier_payments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Payment deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete payment: ${error.message}`);
    },
  });
}

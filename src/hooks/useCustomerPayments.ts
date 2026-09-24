import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type PaymentMode = Database['public']['Enums']['payment_mode'];

export interface CustomerPayment {
  id: string;
  customer_id: string;
  sales_order_id: string | null;
  amount: number;
  payment_date: string;
  payment_mode: PaymentMode;
  transaction_reference: string | null;
  bank_name: string | null;
  receipt_url: string | null;
  received_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sales_order?: {
    order_number: string;
  } | null;
  receiver?: {
    full_name: string;
  } | null;
}

export interface CreatePaymentData {
  customer_id: string;
  sales_order_id?: string;
  amount: number;
  payment_date: string;
  payment_mode: PaymentMode;
  transaction_reference?: string;
  bank_name?: string;
  notes?: string;
  receipt_url?: string;
}

export function useCustomerPayments(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-payments', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('customer_payments')
        .select(`
          *,
          sales_order:sales_orders(order_number),
          receiver:profiles!customer_payments_received_by_fkey(full_name)
        `)
        .eq('customer_id', customerId)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data as CustomerPayment[];
    },
    enabled: !!customerId,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePaymentData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: payment, error } = await supabase
        .from('customer_payments')
        .insert({
          ...data,
          received_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return payment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-payments', variables.customer_id] });
      queryClient.invalidateQueries({ queryKey: ['customer-ledger', variables.customer_id] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-unified-data'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-stats'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-aging'] });
      queryClient.invalidateQueries({ queryKey: ['top-outstanding-customers'] });
      queryClient.invalidateQueries({ queryKey: ['payment-collection-trend'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-drilldown'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Payment recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record payment', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUploadReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, file, customerId }: { paymentId: string; file: File; customerId: string }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${paymentId}-receipt.${fileExt}`;
      const filePath = `${customerId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('order-documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('order-documents')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('customer_payments')
        .update({ receipt_url: publicUrl })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-payments', variables.customerId] });
    },
  });
}

export function useCustomerLedger(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-ledger', customerId],
    queryFn: async () => {
      if (!customerId) return { orders: [], payments: [], ledgerEntries: [] };

      // Fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from('sales_orders')
        .select('id, order_number, order_value, created_at, status')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true });

      if (ordersError) throw ordersError;

      // Fetch payments
      const { data: payments, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('id, amount, payment_date, payment_mode, transaction_reference')
        .eq('customer_id', customerId)
        .order('payment_date', { ascending: true });

      if (paymentsError) throw paymentsError;

      // Create ledger entries
      const ledgerEntries: Array<{
        id: string;
        date: string;
        type: 'debit' | 'credit';
        description: string;
        amount: number;
        reference: string;
        balance: number;
      }> = [];

      let runningBalance = 0;

      // Combine and sort entries
      const allEntries = [
        ...(orders || []).map(o => ({
          id: o.id,
          date: o.created_at,
          type: 'debit' as const,
          description: `Sales Order ${o.order_number}`,
          amount: o.order_value || 0,
          reference: o.order_number,
        })),
        ...(payments || []).map(p => ({
          id: p.id,
          date: p.payment_date,
          type: 'credit' as const,
          description: `Payment via ${p.payment_mode.toUpperCase()}`,
          amount: p.amount,
          reference: p.transaction_reference || '-',
        })),
      ].sort((a, b) => {
        // Compare dates first (date only, ignore time)
        const dateA = new Date(a.date).toDateString();
        const dateB = new Date(b.date).toDateString();
        
        if (dateA !== dateB) {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        
        // On same date, debits come before credits (order before payment)
        if (a.type !== b.type) {
          return a.type === 'debit' ? -1 : 1;
        }
        
        // Same date and type - sort by actual timestamp
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      for (const entry of allEntries) {
        if (entry.type === 'debit') {
          runningBalance += entry.amount;
        } else {
          runningBalance -= entry.amount;
        }
        ledgerEntries.push({ ...entry, balance: runningBalance });
      }

      return { orders, payments, ledgerEntries };
    },
    enabled: !!customerId,
  });
}

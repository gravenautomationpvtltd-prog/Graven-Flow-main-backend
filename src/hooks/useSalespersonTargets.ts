import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const SALESPERSON_METRICS = {
  leads_converted: { label: 'Leads Converted', unit: 'count', icon: '🎯' },
  sales_value: { label: 'Sales Value', unit: 'currency', icon: '💰' },
  customers_added: { label: 'Customers Added', unit: 'count', icon: '👥' },
  quotations_sent: { label: 'Quotations Sent', unit: 'count', icon: '📋' },
  orders_count: { label: 'Orders Count', unit: 'count', icon: '📦' },
} as const;

export type SalespersonMetricKey = keyof typeof SALESPERSON_METRICS;

export interface SalespersonTarget {
  id: string;
  user_id: string;
  metric: SalespersonMetricKey;
  target_type: string;
  year: number;
  month: number;
  target_amount: number;
}

export function useSalespersonTargets(userId: string | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ['salesperson-targets', userId, year, month],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('sales_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('year', year)
        .eq('month', month)
        .eq('target_type', 'monthly')
        .not('metric', 'is', null);

      if (error) throw error;
      return data as SalespersonTarget[];
    },
    enabled: !!userId,
  });
}

interface UpsertSalespersonTargetParams {
  user_id: string;
  target_type: string;
  year: number;
  month: number;
  metric: SalespersonMetricKey;
  target_amount: number;
}

export function useUpsertSalespersonTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpsertSalespersonTargetParams) => {
      // Check if target exists
      const { data: existing } = await supabase
        .from('sales_targets')
        .select('id')
        .eq('user_id', params.user_id)
        .eq('metric', params.metric)
        .eq('target_type', params.target_type)
        .eq('year', params.year)
        .eq('month', params.month)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('sales_targets')
          .update({ target_amount: params.target_amount })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('sales_targets')
          .insert({
            user_id: params.user_id,
            metric: params.metric,
            target_type: params.target_type,
            year: params.year,
            month: params.month,
            target_amount: params.target_amount,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesperson-targets'] });
      toast.success('Target saved successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to save target: ' + error.message);
    },
  });
}

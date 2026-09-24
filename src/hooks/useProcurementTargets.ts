import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ProcurementMetric = 'price_resolutions' | 'products_added' | 'po_count' | 'resolution_time_hours' | 'po_value';
type TargetPeriodType = 'monthly' | 'quarterly';

interface ProcurementTarget {
  id: string;
  user_id: string;
  target_type: TargetPeriodType;
  year: number;
  month: number | null;
  quarter: number | null;
  metric: ProcurementMetric;
  target_value: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TargetWithProfile extends ProcurementTarget {
  profiles?: { full_name: string } | null;
}

export function useProcurementTargets(year: number, month?: number, quarter?: number) {
  return useQuery({
    queryKey: ['procurement-targets', year, month, quarter],
    queryFn: async () => {
      let query = supabase
        .from('procurement_targets')
        .select('*, profiles:profiles!procurement_targets_user_id_fkey(full_name)')
        .eq('year', year);

      if (month) {
        query = query.eq('target_type', 'monthly').eq('month', month);
      } else if (quarter) {
        query = query.eq('target_type', 'quarterly').eq('quarter', quarter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TargetWithProfile[];
    },
  });
}

export function useUserProcurementTargets(userId: string, year: number, month?: number) {
  return useQuery({
    queryKey: ['procurement-targets-user', userId, year, month],
    queryFn: async () => {
      let query = supabase
        .from('procurement_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('year', year);

      if (month) {
        query = query.eq('target_type', 'monthly').eq('month', month);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProcurementTarget[];
    },
    enabled: !!userId,
  });
}

export function useCreateProcurementTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (target: {
      user_id: string;
      target_type: TargetPeriodType;
      year: number;
      month?: number;
      quarter?: number;
      metric: ProcurementMetric;
      target_value: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('procurement_targets')
        .insert({
          ...target,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-targets'] });
      toast.success('Target created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create target: ' + error.message);
    },
  });
}

export function useUpsertProcurementTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (target: {
      user_id: string;
      target_type: TargetPeriodType;
      year: number;
      month?: number;
      quarter?: number;
      metric: ProcurementMetric;
      target_value: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Check if target exists
      let query = supabase
        .from('procurement_targets')
        .select('id')
        .eq('user_id', target.user_id)
        .eq('year', target.year)
        .eq('target_type', target.target_type)
        .eq('metric', target.metric);

      if (target.month) {
        query = query.eq('month', target.month);
      }
      if (target.quarter) {
        query = query.eq('quarter', target.quarter);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('procurement_targets')
          .update({ target_value: target.target_value })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('procurement_targets')
          .insert({
            ...target,
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-targets'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-performance'] });
      toast.success('Target saved successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to save target: ' + error.message);
    },
  });
}

export function useDeleteProcurementTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('procurement_targets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-targets'] });
      toast.success('Target deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete target: ' + error.message);
    },
  });
}

export const PROCUREMENT_METRICS = {
  price_resolutions: { label: 'Price Resolutions', unit: 'count', icon: '💰' },
  products_added: { label: 'Products Added', unit: 'count', icon: '📦' },
  po_count: { label: 'POs Created', unit: 'count', icon: '📋' },
  resolution_time_hours: { label: 'Avg Resolution Time', unit: 'hours', icon: '⏱️' },
  po_value: { label: 'Total PO Value', unit: 'currency', icon: '💵' },
} as const;

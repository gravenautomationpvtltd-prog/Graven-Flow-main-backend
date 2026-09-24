import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ensureFreshSession } from '@/utils/sessionGuard';

interface SalesTarget {
  id: string;
  office_id: string | null;
  user_id: string | null;
  target_type: 'monthly' | 'quarterly';
  year: number;
  month: number | null;
  quarter: number | null;
  target_amount: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TargetWithOffice extends SalesTarget {
  offices?: { name: string } | null;
}

interface TargetAnalysis {
  totalTarget: number;
  totalActual: number;
  gap: number;
  progressPercent: number;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  dailyRunRate: number;
  requiredDailyRate: number;
  projectedTotal: number;
  isOnTrack: boolean;
  officeBreakdown: {
    officeId: string;
    officeName: string;
    target: number;
    actual: number;
    gap: number;
    progressPercent: number;
    status: 'ahead' | 'on-track' | 'behind';
  }[];
}

export function useSalesTargets(year: number, month?: number, quarter?: number) {
  return useQuery({
    queryKey: ['sales-targets', year, month, quarter],
    queryFn: async () => {
      let query = supabase
        .from('sales_targets')
        .select('*, offices(name)')
        .eq('year', year);

      if (month) {
        query = query.eq('target_type', 'monthly').eq('month', month);
      } else if (quarter) {
        query = query.eq('target_type', 'quarterly').eq('quarter', quarter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TargetWithOffice[];
    },
  });
}

export function useTargetAnalysis(year: number, month: number) {
  return useQuery({
    queryKey: ['target-analysis', year, month],
    queryFn: async () => {
      // Get targets for the month
      const { data: targets, error: targetsError } = await supabase
        .from('sales_targets')
        .select('*, offices(name)')
        .eq('year', year)
        .eq('month', month)
        .eq('target_type', 'monthly');

      if (targetsError) throw targetsError;

      // Get offices
      const { data: offices, error: officesError } = await supabase
        .from('offices')
        .select('id, name');

      if (officesError) throw officesError;

      // Calculate date range for the month
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      const today = new Date();
      const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

      // Get actual sales for the month - join with leads to get office_id
      const { data: salesData, error: salesError } = await supabase
        .from('sales_orders')
        .select('order_value, lead_id, leads(office_id)')
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      if (salesError) throw salesError;

      // Calculate totals
      const totalTarget = (targets || []).reduce((sum, t) => sum + Number(t.target_amount), 0);
      const totalActual = (salesData || []).reduce((sum, s) => sum + Number(s.order_value || 0), 0);

      // Calculate days
      const totalDays = endOfMonth.getDate();
      const daysElapsed = isCurrentMonth ? Math.min(today.getDate(), totalDays) : totalDays;
      const daysRemaining = isCurrentMonth ? totalDays - daysElapsed : 0;

      // Calculate rates
      const dailyRunRate = daysElapsed > 0 ? totalActual / daysElapsed : 0;
      const requiredDailyRate = daysRemaining > 0 ? (totalTarget - totalActual) / daysRemaining : 0;
      const projectedTotal = dailyRunRate * totalDays;

      // Office breakdown
      const officeBreakdown = (offices || []).map(office => {
        const officeTarget = (targets || []).find(t => t.office_id === office.id);
        const target = officeTarget ? Number(officeTarget.target_amount) : 0;
        const actual = (salesData || [])
          .filter(s => (s.leads as any)?.office_id === office.id)
          .reduce((sum, s) => sum + Number(s.order_value || 0), 0);
        const gap = target - actual;
        const progressPercent = target > 0 ? (actual / target) * 100 : 0;
        
        let status: 'ahead' | 'on-track' | 'behind' = 'on-track';
        const expectedProgress = (daysElapsed / totalDays) * 100;
        if (progressPercent > expectedProgress + 10) status = 'ahead';
        else if (progressPercent < expectedProgress - 10) status = 'behind';

        return {
          officeId: office.id,
          officeName: office.name,
          target,
          actual,
          gap,
          progressPercent,
          status,
        };
      }).filter(o => o.target > 0 || o.actual > 0);

      const analysis: TargetAnalysis = {
        totalTarget,
        totalActual,
        gap: totalTarget - totalActual,
        progressPercent: totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0,
        daysElapsed,
        daysRemaining,
        totalDays,
        dailyRunRate,
        requiredDailyRate,
        projectedTotal,
        isOnTrack: projectedTotal >= totalTarget,
        officeBreakdown,
      };

      return analysis;
    },
  });
}

export function useCreateTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (target: {
      office_id?: string;
      user_id?: string;
      target_type: 'monthly' | 'quarterly';
      year: number;
      month?: number;
      quarter?: number;
      target_amount: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      await ensureFreshSession();
      const { data, error } = await supabase
        .from('sales_targets')
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
      queryClient.invalidateQueries({ queryKey: ['sales-targets'] });
      queryClient.invalidateQueries({ queryKey: ['target-analysis'] });
      toast.success('Target created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create target: ' + error.message);
    },
  });
}

export function useUpdateTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, target_amount }: { id: string; target_amount: number }) => {
      await ensureFreshSession();
      const { data, error } = await supabase
        .from('sales_targets')
        .update({ target_amount })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-targets'] });
      queryClient.invalidateQueries({ queryKey: ['target-analysis'] });
      toast.success('Target updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update target: ' + error.message);
    },
  });
}

export function useDeleteTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sales_targets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-targets'] });
      queryClient.invalidateQueries({ queryKey: ['target-analysis'] });
      toast.success('Target deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete target: ' + error.message);
    },
  });
}

export function useUpsertTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (target: {
      office_id: string;
      target_type: 'monthly' | 'quarterly';
      year: number;
      month?: number;
      quarter?: number;
      target_amount: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Check if target exists
      let query = supabase
        .from('sales_targets')
        .select('id')
        .eq('office_id', target.office_id)
        .eq('year', target.year)
        .eq('target_type', target.target_type);

      if (target.month) {
        query = query.eq('month', target.month);
      }
      if (target.quarter) {
        query = query.eq('quarter', target.quarter);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('sales_targets')
          .update({ target_amount: target.target_amount })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('sales_targets')
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
      queryClient.invalidateQueries({ queryKey: ['sales-targets'] });
      queryClient.invalidateQueries({ queryKey: ['target-analysis'] });
      toast.success('Target saved successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to save target: ' + error.message);
    },
  });
}

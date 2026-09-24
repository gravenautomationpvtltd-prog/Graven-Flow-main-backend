import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';

type HolidayType = Database['public']['Enums']['holiday_type'];

export interface Holiday {
  id: string;
  name: string;
  date: string;
  holiday_type: HolidayType;
  is_half_day: boolean;
  half_day_type: string | null;
  office_id: string | null;
  description: string | null;
  year: number;
  is_recurring: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  offices?: { name: string } | null;
}

export interface CreateHolidayData {
  name: string;
  date: string;
  holiday_type: HolidayType;
  is_half_day?: boolean;
  half_day_type?: string | null;
  office_id?: string | null;
  description?: string | null;
  is_recurring?: boolean;
}

export interface UpdateHolidayData extends Partial<CreateHolidayData> {
  id: string;
}

export function useHolidays(year?: number, officeId?: string | null) {
  const targetYear = year ?? new Date().getFullYear();

  return useQuery({
    queryKey: ['holidays', targetYear, officeId],
    queryFn: async () => {
      let query = supabase
        .from('holidays')
        .select('*, offices(name)')
        .eq('year', targetYear)
        .order('date', { ascending: true });

      if (officeId) {
        query = query.or(`office_id.eq.${officeId},office_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Holiday[];
    },
  });
}

export function useHolidaysInRange(startDate: string, endDate: string, officeId?: string | null) {
  return useQuery({
    queryKey: ['holidays-range', startDate, endDate, officeId],
    queryFn: async () => {
      let query = supabase
        .from('holidays')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (officeId) {
        query = query.or(`office_id.eq.${officeId},office_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Holiday[];
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateHolidayData) => {
      const year = parseISO(data.date).getFullYear();
      await ensureFreshSession();
      const tenantId = await requireTenantId();
      
      const { data: holiday, error } = await supabase
        .from('holidays')
        .insert({
          ...data,
          year,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          tenant_id: tenantId,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return holiday;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['holidays-range'] });
      toast.success('Holiday added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add holiday: ' + error.message);
    },
  });
}

export function useUpdateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateHolidayData) => {
      const updateData: Record<string, unknown> = { ...data };
      
      if (data.date) {
        updateData.year = parseISO(data.date).getFullYear();
      }

      const { data: holiday, error } = await supabase
        .from('holidays')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return holiday;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['holidays-range'] });
      toast.success('Holiday updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update holiday: ' + error.message);
    },
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['holidays-range'] });
      toast.success('Holiday deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete holiday: ' + error.message);
    },
  });
}

// Helper to check if a date is a holiday
export function isHoliday(date: Date, holidays: Holiday[]): Holiday | null {
  const dateStr = format(date, 'yyyy-MM-dd');
  return holidays.find(h => h.date === dateStr) || null;
}

// Get holiday type display label
export function getHolidayTypeLabel(type: HolidayType): string {
  const labels: Record<HolidayType, string> = {
    national: 'National Holiday',
    company: 'Company Holiday',
    regional: 'Regional Holiday',
    optional: 'Optional Holiday',
  };
  return labels[type];
}

// Get holiday type color
export function getHolidayTypeColor(type: HolidayType): string {
  const colors: Record<HolidayType, string> = {
    national: 'bg-red-500',
    company: 'bg-orange-500',
    regional: 'bg-purple-500',
    optional: 'bg-yellow-500',
  };
  return colors[type];
}

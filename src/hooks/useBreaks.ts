import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInMinutes } from 'date-fns';

export type BreakType = 'lunch' | 'tea' | 'personal' | 'other';

interface BreakRecord {
  id: string;
  attendance_id: string;
  user_id: string;
  break_type: BreakType;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Get active break (a break that hasn't ended yet)
export function useActiveBreak(userId?: string) {
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['active-break', userId, today],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('break_records')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)
        .is('end_time', null)
        .maybeSingle();

      if (error) throw error;
      return data as BreakRecord | null;
    },
    enabled: !!userId,
    refetchInterval: 120000, // Refresh every 2 minutes (foreground only)
    refetchIntervalInBackground: false,
  });
}

// Get all breaks for today
export function useTodayBreaks(userId?: string) {
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['today-breaks', userId, today],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('break_records')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BreakRecord[];
    },
    enabled: !!userId,
  });
}

// Start a new break
export function useStartBreak() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      attendanceId,
      breakType,
      notes,
    }: {
      userId: string;
      attendanceId: string;
      breakType: BreakType;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('break_records')
        .insert({
          user_id: userId,
          attendance_id: attendanceId,
          break_type: breakType,
          start_time: new Date().toISOString(),
          notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      queryClient.invalidateQueries({ queryKey: ['active-break', variables.userId, today] });
      queryClient.invalidateQueries({ queryKey: ['today-breaks', variables.userId, today] });
      
      const breakLabels: Record<BreakType, string> = {
        lunch: 'Lunch break',
        tea: 'Tea break',
        personal: 'Personal break',
        other: 'Break',
      };
      toast.success(`${breakLabels[variables.breakType]} started!`);
    },
    onError: (error: Error) => {
      console.error('Start break error:', error);
      toast.error(`Failed to start break: ${error.message}`);
    },
  });
}

// End an active break
export function useEndBreak() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      breakId,
      userId,
    }: {
      breakId: string;
      userId: string;
    }) => {
      // First get the break to calculate duration
      const { data: breakRecord, error: fetchError } = await supabase
        .from('break_records')
        .select('*')
        .eq('id', breakId)
        .single();

      if (fetchError) throw fetchError;

      const startTime = new Date(breakRecord.start_time);
      const endTime = new Date();
      const durationMinutes = differenceInMinutes(endTime, startTime);

      const { data, error } = await supabase
        .from('break_records')
        .update({
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', breakId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      queryClient.invalidateQueries({ queryKey: ['active-break', variables.userId, today] });
      queryClient.invalidateQueries({ queryKey: ['today-breaks', variables.userId, today] });
      toast.success(`Break ended! Duration: ${data.duration_minutes} minutes`);
    },
    onError: (error: Error) => {
      console.error('End break error:', error);
      toast.error(`Failed to end break: ${error.message}`);
    },
  });
}

// Calculate total break time for today in minutes
export function calculateTotalBreakTime(breaks: BreakRecord[]): number {
  return breaks.reduce((total, breakRecord) => {
    if (breakRecord.end_time) {
      return total + breakRecord.duration_minutes;
    } else {
      // For active break, calculate current duration
      const startTime = new Date(breakRecord.start_time);
      const currentDuration = differenceInMinutes(new Date(), startTime);
      return total + currentDuration;
    }
  }, 0);
}

// Format minutes to hours and minutes string
export function formatBreakTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

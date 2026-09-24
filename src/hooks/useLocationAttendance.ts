import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInMinutes } from 'date-fns';

interface TodayAttendance {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  is_late: boolean;
  late_minutes: number;
  is_early_departure: boolean;
  early_departure_minutes: number;
  total_hours_worked: number | null;
  status: string;
  attendance_type: string | null;
  selfie_url: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
}

export function useTodayAttendance(userId?: string) {
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['today-attendance', userId, today],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (error) throw error;
      return data as TodayAttendance | null;
    },
    enabled: !!userId,
  });
}

export function useUserOffice(officeId?: string | null) {
  return useQuery({
    queryKey: ['user-office', officeId],
    queryFn: async () => {
      if (!officeId) return null;

      const { data, error } = await supabase
        .from('offices')
        .select('id, name, latitude, longitude, geofence_radius_meters, opening_time, closing_time')
        .eq('id', officeId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!officeId,
  });
}

// Helper function to parse time string to today's date
function parseTimeToDate(timeString: string): Date {
  const today = new Date();
  const [hours, minutes] = timeString.split(':').map(Number);
  today.setHours(hours, minutes, 0, 0);
  return today;
}

export function useLocationCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      officeId,
      latitude,
      longitude,
      attendanceType,
      selfieUrl,
    }: {
      userId: string;
      officeId: string | null;
      latitude: number;
      longitude: number;
      attendanceType: 'office' | 'field' | 'remote';
      selfieUrl?: string;
    }) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date().toISOString();

      // Check if record exists for today
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        // If user was already checked out, allow re-check-in by clearing checkout data
        if (existing.check_out_time) {
          const { data: resumedData, error: resumeError } = await supabase
            .from('attendance_records')
            .update({
              check_out_time: null,
              check_out_latitude: null,
              check_out_longitude: null,
              total_hours_worked: 0,
              is_early_departure: false,
              early_departure_minutes: 0,
            })
            .eq('id', existing.id)
            .select()
            .single();
          
          if (resumeError) throw resumeError;
          toast.success('Welcome back! Your attendance has been resumed.');
          return resumedData;
        }
        return existing;
      }

      // Get office opening time to calculate lateness
      let isLate = false;
      let lateMinutes = 0;

      if (officeId) {
        const { data: office } = await supabase
          .from('offices')
          .select('opening_time')
          .eq('id', officeId)
          .maybeSingle();

        if (office?.opening_time) {
          const openingTime = parseTimeToDate(office.opening_time);
          const checkInDate = new Date();

          if (checkInDate > openingTime) {
            isLate = true;
            lateMinutes = differenceInMinutes(checkInDate, openingTime);
          }
        }
      }

      const { data, error } = await supabase
        .from('attendance_records')
        .insert({
          user_id: userId,
          office_id: officeId,
          date: today,
          check_in_time: now,
          check_in_latitude: latitude,
          check_in_longitude: longitude,
          attendance_type: attendanceType,
          selfie_url: selfieUrl || null,
          is_late: isLate,
          late_minutes: lateMinutes,
          status: 'present',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
    },
    onError: (error: Error) => {
      console.error('Check-in error:', error);
      toast.error(`Check-in failed: ${error.message}`);
    },
  });
}

export function useLocationCheckOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      officeId,
      latitude,
      longitude,
    }: {
      userId: string;
      officeId: string | null;
      latitude: number;
      longitude: number;
    }) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date();

      // Get today's attendance record
      const { data: record } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (!record) {
        throw new Error('No check-in record found for today');
      }

      // Calculate early departure if applicable
      let isEarlyDeparture = false;
      let earlyDepartureMinutes = 0;

      if (officeId) {
        const { data: office } = await supabase
          .from('offices')
          .select('closing_time')
          .eq('id', officeId)
          .maybeSingle();

        if (office?.closing_time) {
          const closingTime = parseTimeToDate(office.closing_time);

          if (now < closingTime) {
            isEarlyDeparture = true;
            earlyDepartureMinutes = differenceInMinutes(closingTime, now);
          }
        }
      }

      // Calculate total hours worked
      const checkInTime = record.check_in_time ? new Date(record.check_in_time) : now;
      const totalMinutes = differenceInMinutes(now, checkInTime);
      const totalHoursWorked = Math.round((totalMinutes / 60) * 100) / 100;

      const { data, error } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: now.toISOString(),
          check_out_latitude: latitude,
          check_out_longitude: longitude,
          is_early_departure: isEarlyDeparture,
          early_departure_minutes: earlyDepartureMinutes,
          total_hours_worked: totalHoursWorked,
        })
        .eq('id', record.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
    },
    onError: (error: Error) => {
      console.error('Check-out error:', error);
      toast.error(`Check-out failed: ${error.message}`);
    },
  });
}

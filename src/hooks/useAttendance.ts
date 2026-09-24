import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInMinutes, parseISO, startOfMonth, endOfMonth } from 'date-fns';

interface AttendanceRecord {
  id: string;
  user_id: string;
  office_id: string | null;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  is_late: boolean;
  is_early_departure: boolean;
  late_minutes: number;
  early_departure_minutes: number;
  total_hours_worked: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    full_name: string;
    email: string;
    office_id: string | null;
  };
  offices?: {
    id: string;
    name: string;
    location: string;
    opening_time: string | null;
    closing_time: string | null;
  };
}

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface AttendanceFilters {
  userId?: string;
  officeId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
}

// Fetch attendance records with filters
export function useAttendanceRecords(filters: AttendanceFilters = {}) {
  return useQuery({
    queryKey: ['attendance-records', filters],
    queryFn: async () => {
      let query = supabase
        .from('attendance_records')
        .select(`
          *,
          profiles:user_id (id, full_name, email, office_id),
          offices:office_id (id, name, location, opening_time, closing_time)
        `)
        .order('date', { ascending: false });

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.officeId) {
        query = query.eq('office_id', filters.officeId);
      }
      if (filters.startDate) {
        query = query.gte('date', format(filters.startDate, 'yyyy-MM-dd'));
      }
      if (filters.endDate) {
        query = query.lte('date', format(filters.endDate, 'yyyy-MM-dd'));
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });
}

// Fetch leave requests
export function useLeaveRequests(filters: { userId?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ['leave-requests', filters],
    queryFn: async () => {
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          profiles!leave_requests_user_id_fkey (id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LeaveRequest[];
    },
  });
}

// Record check-in (auto on login)
export function useRecordCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, officeId }: { userId: string; officeId: string | null }) => {
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
        // If already has check_in but also has check_out, allow re-check-in
        // This handles the case where users were wrongly auto-checked-out
        if (existing.check_in_time && existing.check_out_time) {
          const { data, error } = await supabase
            .from('attendance_records')
            .update({
              check_out_time: null,
              total_hours_worked: 0,
              is_early_departure: false,
              early_departure_minutes: 0,
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) throw error;
          toast.success('Welcome back! Your attendance has been resumed.');
          return data;
        }
        // Already checked in and not checked out - skip
        return existing;
      }

      // Get office opening time to calculate lateness
      let isLate = false;
      let lateMinutes = 0;

      if (officeId) {
        const { data: office } = await supabase
          .from('offices')
          .select('opening_time, closing_time')
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
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
    },
    onError: (error: Error) => {
      console.error('Check-in error:', error);
    },
  });
}

// Record check-out
export function useRecordCheckOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, officeId }: { userId: string; officeId: string | null }) => {
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
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
    },
  });
}

// Create leave request
export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leave: {
      user_id: string;
      leave_type: string;
      start_date: string;
      end_date: string;
      reason?: string;
    }) => {
      const { data, error } = await supabase
        .from('leave_requests')
        .insert(leave)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success('Leave request submitted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit leave request: ${error.message}`);
    },
  });
}

// Approve/Reject leave request (HR/Admin only)
export function useUpdateLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      approved_by,
      rejection_reason 
    }: { 
      id: string; 
      status: 'approved' | 'rejected';
      approved_by: string;
      rejection_reason?: string;
    }) => {
      const { data, error } = await supabase
        .from('leave_requests')
        .update({
          status,
          approved_by,
          approved_at: new Date().toISOString(),
          rejection_reason,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success(`Leave request ${variables.status}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update leave request: ${error.message}`);
    },
  });
}

// Get monthly attendance report
export function useMonthlyAttendanceReport(month: Date, officeId?: string) {
  return useQuery({
    queryKey: ['attendance-report', format(month, 'yyyy-MM'), officeId],
    queryFn: async () => {
      const start = startOfMonth(month);
      const end = endOfMonth(month);

      let query = supabase
        .from('attendance_records')
        .select(`
          *,
          profiles:user_id (id, full_name, email, office_id)
        `)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'));

      if (officeId) {
        query = query.eq('office_id', officeId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Aggregate by user
      const userStats: Record<string, {
        user: { id: string; full_name: string; email: string };
        presentDays: number;
        lateDays: number;
        earlyDepartures: number;
        totalLateMinutes: number;
        totalEarlyDepartureMinutes: number;
        totalHoursWorked: number;
        leaveDays: number;
        absentDays: number;
      }> = {};

      (data as AttendanceRecord[]).forEach(record => {
        const userId = record.user_id;
        if (!userStats[userId] && record.profiles) {
          userStats[userId] = {
            user: record.profiles,
            presentDays: 0,
            lateDays: 0,
            earlyDepartures: 0,
            totalLateMinutes: 0,
            totalEarlyDepartureMinutes: 0,
            totalHoursWorked: 0,
            leaveDays: 0,
            absentDays: 0,
          };
        }

        if (userStats[userId]) {
          if (record.status === 'present') userStats[userId].presentDays++;
          if (record.status === 'leave') userStats[userId].leaveDays++;
          if (record.status === 'absent') userStats[userId].absentDays++;
          if (record.is_late) userStats[userId].lateDays++;
          if (record.is_early_departure) userStats[userId].earlyDepartures++;
          userStats[userId].totalLateMinutes += record.late_minutes || 0;
          userStats[userId].totalEarlyDepartureMinutes += record.early_departure_minutes || 0;
          userStats[userId].totalHoursWorked += record.total_hours_worked || 0;
        }
      });

      return Object.values(userStats);
    },
  });
}

// Helper function to parse time string to today's date
function parseTimeToDate(timeString: string): Date {
  const today = new Date();
  const [hours, minutes] = timeString.split(':').map(Number);
  today.setHours(hours, minutes, 0, 0);
  return today;
}

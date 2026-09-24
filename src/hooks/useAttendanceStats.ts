import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, format, differenceInDays, isWeekend, eachDayOfInterval, parseISO } from 'date-fns';

interface AttendanceStats {
  attendanceRate: number;
  onTimeRate: number;
  totalHours: number;
  leaveBalance: number;
  presentDays: number;
  lateDays: number;
  workingDays: number;
  approvedLeaves: number;
}

export function useAttendanceStats(userId: string, month?: number, year?: number) {
  const targetMonth = month ?? new Date().getMonth();
  const targetYear = year ?? new Date().getFullYear();
  
  return useQuery({
    queryKey: ['attendance-stats', userId, targetMonth, targetYear],
    queryFn: async (): Promise<AttendanceStats> => {
      const monthDate = new Date(targetYear, targetMonth, 1);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const yearStart = startOfYear(new Date(targetYear, 0, 1));
      const yearEnd = endOfYear(new Date(targetYear, 0, 1));

      // Fetch attendance records for selected month
      const { data: attendanceRecords } = await supabase
        .from('attendance_records')
        .select('date, status, is_late, total_hours_worked')
        .eq('user_id', userId)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));

      // Fetch approved leave requests for the year
      const { data: leaveRequests } = await supabase
        .from('leave_requests')
        .select('start_date, end_date, status')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('start_date', format(yearStart, 'yyyy-MM-dd'))
        .lte('end_date', format(yearEnd, 'yyyy-MM-dd'));

      // Fetch holidays for the month
      const { data: holidays } = await supabase
        .from('holidays')
        .select('date')
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));

      // Create set of holiday dates
      const holidayDates = new Set((holidays || []).map(h => h.date));

      // Calculate working days in selected month (excluding weekends and holidays)
      const now = new Date();
      const isCurrentMonth = targetMonth === now.getMonth() && targetYear === now.getFullYear();
      const endDate = isCurrentMonth && now < monthEnd ? now : monthEnd;
      
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: endDate });
      const workingDays = daysInMonth.filter(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        return !isWeekend(day) && !holidayDates.has(dateStr);
      }).length;

      // Calculate stats from attendance records
      const records = attendanceRecords || [];
      const presentDays = records.filter(r => r.status === 'present').length;
      const lateDays = records.filter(r => r.is_late).length;
      const totalHours = records.reduce((sum, r) => sum + (Number(r.total_hours_worked) || 0), 0);

      // Calculate on-time rate
      const onTimeDays = presentDays - lateDays;
      const onTimeRate = presentDays > 0 ? Math.round((onTimeDays / presentDays) * 100) : 100;

      // Calculate attendance rate
      const attendanceRate = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 100;

      // Calculate leave balance (assuming 24 days annual entitlement)
      const annualEntitlement = 24;
      const approvedLeaves = (leaveRequests || []).reduce((sum, leave) => {
        const start = parseISO(leave.start_date);
        const end = parseISO(leave.end_date);
        return sum + differenceInDays(end, start) + 1;
      }, 0);
      const leaveBalance = Math.max(0, annualEntitlement - approvedLeaves);

      return {
        attendanceRate,
        onTimeRate,
        totalHours: Math.round(totalHours * 10) / 10,
        leaveBalance,
        presentDays,
        lateDays,
        workingDays,
        approvedLeaves,
      };
    },
    enabled: !!userId,
  });
}

export function useMonthlyAttendanceCalendar(userId: string) {
  return useQuery({
    queryKey: ['attendance-calendar-monthly', userId],
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // Fetch attendance records for current month
      const { data: attendanceRecords } = await supabase
        .from('attendance_records')
        .select('date, status, is_late')
        .eq('user_id', userId)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));

      // Fetch approved leave requests for current month
      const { data: leaveRequests } = await supabase
        .from('leave_requests')
        .select('start_date, end_date, status')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('start_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('end_date', format(monthEnd, 'yyyy-MM-dd'));

      // Build calendar data
      const calendarData: Record<string, { status: string; isLate: boolean }> = {};

      // Add attendance records
      (attendanceRecords || []).forEach(record => {
        calendarData[record.date] = {
          status: record.status || 'present',
          isLate: record.is_late || false,
        };
      });

      // Add leave days
      (leaveRequests || []).forEach(leave => {
        const start = parseISO(leave.start_date);
        const end = parseISO(leave.end_date);
        const days = eachDayOfInterval({ start, end });
        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          if (!calendarData[dateStr]) {
            calendarData[dateStr] = { status: 'leave', isLate: false };
          }
        });
      });

      return calendarData;
    },
    enabled: !!userId,
  });
}

// New hook for yearly calendar data
export function useYearlyAttendanceCalendar(userId: string, year?: number) {
  const targetYear = year ?? new Date().getFullYear();
  return useQuery({
    queryKey: ['attendance-calendar-yearly', userId, targetYear],
    queryFn: async () => {
      const yearDate = new Date(targetYear, 0, 1);
      const yearStart = startOfYear(yearDate);
      const yearEnd = endOfYear(yearDate);

      // Fetch attendance records for entire year
      const { data: attendanceRecords } = await supabase
        .from('attendance_records')
        .select('date, status, is_late')
        .eq('user_id', userId)
        .gte('date', format(yearStart, 'yyyy-MM-dd'))
        .lte('date', format(yearEnd, 'yyyy-MM-dd'));

      // Fetch approved leave requests for entire year
      const { data: leaveRequests } = await supabase
        .from('leave_requests')
        .select('start_date, end_date, status')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('start_date', format(yearStart, 'yyyy-MM-dd'))
        .lte('end_date', format(yearEnd, 'yyyy-MM-dd'));

      // Build calendar data for all 12 months
      const calendarData: Record<string, { status: string; isLate: boolean }> = {};

      // Add attendance records
      (attendanceRecords || []).forEach(record => {
        calendarData[record.date] = {
          status: record.status || 'present',
          isLate: record.is_late || false,
        };
      });

      // Add leave days
      (leaveRequests || []).forEach(leave => {
        const start = parseISO(leave.start_date);
        const end = parseISO(leave.end_date);
        const days = eachDayOfInterval({ start, end });
        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          if (!calendarData[dateStr]) {
            calendarData[dateStr] = { status: 'leave', isLate: false };
          }
        });
      });

      return calendarData;
    },
    enabled: !!userId,
  });
}

const ANNUAL_LEAVE_ENTITLEMENT = 24;

export function useLeaveBalance(userId: string) {
  return useQuery({
    queryKey: ['leave-balance', userId],
    queryFn: async () => {
      const yearStart = startOfYear(new Date());
      const yearEnd = endOfYear(new Date());

      const { data: leaveRequests, error } = await supabase
        .from('leave_requests')
        .select('start_date, end_date, leave_type, status')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('start_date', format(yearStart, 'yyyy-MM-dd'))
        .lte('end_date', format(yearEnd, 'yyyy-MM-dd'));

      if (error) throw error;

      const usedByType: Record<string, number> = {
        casual: 0,
        sick: 0,
        earned: 0,
        emergency: 0,
      };

      leaveRequests?.forEach(leave => {
        const days = differenceInDays(new Date(leave.end_date), new Date(leave.start_date)) + 1;
        const type = leave.leave_type.toLowerCase();
        if (usedByType[type] !== undefined) {
          usedByType[type] += days;
        }
      });

      const totalUsed = Object.values(usedByType).reduce((sum, val) => sum + val, 0);

      return {
        total: ANNUAL_LEAVE_ENTITLEMENT,
        used: totalUsed,
        remaining: Math.max(0, ANNUAL_LEAVE_ENTITLEMENT - totalUsed),
        byType: usedByType,
      };
    },
    enabled: !!userId,
  });
}

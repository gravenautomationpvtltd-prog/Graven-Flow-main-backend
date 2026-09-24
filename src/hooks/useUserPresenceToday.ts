import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PresenceStatus = 'present' | 'on_leave' | 'not_checked_in';

/**
 * Returns a map of userId -> presence status for today.
 * Mirrors the logic used by the LQT round-robin picker (pick_next_lqt_user):
 * - 'on_leave'        => has an approved leave covering today
 * - 'present'         => has an attendance record for today with a check_in_time
 *                       and status not in ('absent','on_leave')
 * - 'not_checked_in'  => everything else
 */
export function useUserPresenceToday(userIds: string[] | undefined) {
  const ids = (userIds ?? []).filter(Boolean);
  const key = ids.slice().sort().join(',');

  return useQuery({
    queryKey: ['user-presence-today', key],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);

      const [leavesRes, attendanceRes] = await Promise.all([
        supabase
          .from('leave_requests')
          .select('user_id')
          .in('user_id', ids)
          .eq('status', 'approved')
          .lte('start_date', today)
          .gte('end_date', today),
        supabase
          .from('attendance_records')
          .select('user_id, check_in_time, status')
          .in('user_id', ids)
          .eq('date', today),
      ]);

      const onLeave = new Set((leavesRes.data ?? []).map((r) => r.user_id));
      const presentSet = new Set(
        (attendanceRes.data ?? [])
          .filter(
            (r) =>
              r.check_in_time &&
              r.status !== 'absent' &&
              r.status !== 'on_leave',
          )
          .map((r) => r.user_id),
      );

      const map: Record<string, PresenceStatus> = {};
      for (const id of ids) {
        if (onLeave.has(id)) map[id] = 'on_leave';
        else if (presentSet.has(id)) map[id] = 'present';
        else map[id] = 'not_checked_in';
      }
      return map;
    },
  });
}

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRecordCheckIn } from '@/hooks/useAttendance';

const CHECK_IN_STORAGE_KEY = 'attendance_check_in_time';

/**
 * Hook to automatically record attendance on login.
 * Records check-in on first login of the day.
 * 
 * IMPORTANT: This hook ONLY handles check-in.
 * Check-out is handled:
 * 1. Manually via the "Slide to Check Out" button
 * 2. Automatically when user logs out (in useAuth signOut)
 * 
 * Page refresh does NOT trigger checkout.
 */
export function useAutoAttendance() {
  const { user, profile } = useAuth();
  const checkIn = useRecordCheckIn();
  const hasCheckedIn = useRef(false);

  // Auto check-in on login
  useEffect(() => {
    if (user && profile && !hasCheckedIn.current) {
      const today = new Date().toDateString();
      const storedCheckIn = localStorage.getItem(CHECK_IN_STORAGE_KEY);
      
      // Check if we already checked in today
      if (storedCheckIn) {
        try {
          const { date } = JSON.parse(storedCheckIn);
          if (date === today) {
            // Already checked in today, skip
            hasCheckedIn.current = true;
            return;
          }
        } catch (e) {
          // Invalid JSON, clear it
          localStorage.removeItem(CHECK_IN_STORAGE_KEY);
        }
      }
      
      // New day or first login - perform check-in
      hasCheckedIn.current = true;
      const checkInTime = Date.now();
      
      // Store in localStorage to persist across refreshes
      localStorage.setItem(CHECK_IN_STORAGE_KEY, JSON.stringify({
        date: today,
        timestamp: checkInTime
      }));
      
      checkIn.mutate({ 
        userId: user.id, 
        officeId: profile.office_id 
      });
    }
  }, [user, profile]);

  // Clear localStorage on logout (handled by useAuth signOut)
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Subordinate {
  id: string;
  full_name: string;
  email: string;
}

/**
 * Hook to fetch subordinates (direct reports) for the current user.
 * Returns the list of active profiles where manager_id = current user's ID.
 * For admins/COO, this returns all profiles since they can see everything.
 */
export function useSubordinates() {
  const { user, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['subordinates', user?.id],
    queryFn: async (): Promise<Subordinate[]> => {
      if (!user?.id) return [];

      // Admins see all active profiles
      if (isAdmin) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('is_active', true)
          .order('full_name', { ascending: true });

        if (error) throw error;
        return data || [];
      }

      // Managers only see their direct reports
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('manager_id', user.id)
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });
}

/**
 * Hook to get the list of users a manager can see leads for.
 * This includes themselves + their direct reports (for managers)
 * or all users (for admins).
 */
export function useVisibleUsers() {
  const { user, profile, isAdmin, isManager } = useAuth();
  const { data: subordinates, isLoading } = useSubordinates();

  // For managers: self + subordinates
  // For admins: all users (subordinates query returns all for admins)
  const visibleUsers = (() => {
    if (!user?.id || !profile) return [];
    
    if (isAdmin) {
      // Admins see all (already handled by useSubordinates)
      return subordinates || [];
    }

    if (isManager) {
      // Managers see themselves + their subordinates
      const selfEntry: { id: string; full_name: string; email: string } = {
        id: user.id,
        full_name: profile.full_name || 'Me',
        email: profile.email || '',
      };

      // Include self at the top, then subordinates
      return [selfEntry, ...(subordinates || [])];
    }

    // Regular users only see themselves
    return [{
      id: user.id,
      full_name: profile.full_name || 'Me',
      email: profile.email || '',
    }];
  })();

  return {
    data: visibleUsers,
    isLoading,
  };
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CROPerformanceData {
  cro_user_id: string;
  cro_name: string;
  cro_email: string;
  total_assigned: number;
  contacted: number;
  enquiries: number;
  no_response: number;
  pending: number;
  contact_rate: number;
  last_activity: string | null;
}

export interface CROPerformanceSummary {
  total_cros: number;
  total_assignments: number;
  overall_contact_rate: number;
  total_enquiries: number;
}

export function useCROPerformance() {
  const { user, isAdmin, isManager } = useAuth();

  return useQuery({
    queryKey: ['cro-performance', user?.id],
    queryFn: async () => {
      if (!user?.id) return { performers: [], summary: null };

      // Step 1: Fetch all user IDs with 'cro' role
      const { data: croRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'cro');

      if (rolesError) throw rolesError;

      const croUserIds = (croRoles || []).map(r => r.user_id);
      if (croUserIds.length === 0) {
        return { performers: [], summary: { total_cros: 0, total_assignments: 0, overall_contact_rate: 0, total_enquiries: 0 } };
      }

      // Step 2: Fetch profiles for those CRO user IDs
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, manager_id, is_active')
        .in('id', croUserIds)
        .eq('is_active', true);

      if (profilesError) throw profilesError;

      // Build list of CRO users, filtering by manager hierarchy
      let croUsers: { id: string; full_name: string; email: string }[] = [];

      for (const profile of profiles || []) {
        if (isAdmin) {
          croUsers.push({ id: profile.id, full_name: profile.full_name || 'Unknown', email: profile.email || '' });
        } else if (isManager) {
          if (profile.manager_id === user.id) {
            croUsers.push({ id: profile.id, full_name: profile.full_name || 'Unknown', email: profile.email || '' });
          }
        }
      }

      if (croUsers.length === 0) {
        return { performers: [], summary: { total_cros: 0, total_assignments: 0, overall_contact_rate: 0, total_enquiries: 0 } };
      }

      // Step 2: Fetch aggregated stats using DB function (bypasses 1000-row limit)
      const croIds = croUsers.map(c => c.id);
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_cro_assignment_stats', { p_cro_ids: croIds });

      if (statsError) throw statsError;

      // Build stats map from aggregated results
      const statsMap = new Map<string, {
        total: number; contacted: number; enquiries: number; no_response: number; pending: number; last_activity: string | null;
      }>();

      for (const row of statsData || []) {
        statsMap.set(row.cro_user_id, {
          total: Number(row.total_assigned),
          contacted: Number(row.contacted),
          enquiries: Number(row.enquiries),
          no_response: Number(row.no_response),
          pending: Number(row.pending),
          last_activity: row.last_activity,
        });
      }

      // Step 4: Merge — every CRO appears even with zero assignments
      const performers: CROPerformanceData[] = croUsers.map(cro => {
        const stats = statsMap.get(cro.id) || { total: 0, contacted: 0, enquiries: 0, no_response: 0, pending: 0, last_activity: null };
        return {
          cro_user_id: cro.id,
          cro_name: cro.full_name,
          cro_email: cro.email,
          total_assigned: stats.total,
          contacted: stats.contacted,
          enquiries: stats.enquiries,
          no_response: stats.no_response,
          pending: stats.pending,
          contact_rate: stats.total > 0 ? Math.round(((stats.contacted + stats.enquiries) / stats.total) * 100) : 0,
          last_activity: stats.last_activity,
        };
      });

      performers.sort((a, b) => b.contact_rate - a.contact_rate);

      const summary: CROPerformanceSummary = {
        total_cros: performers.length,
        total_assignments: performers.reduce((s, p) => s + p.total_assigned, 0),
        overall_contact_rate: performers.length > 0
          ? Math.round(
              performers.reduce((s, p) => s + p.contacted + p.enquiries, 0) /
              Math.max(performers.reduce((s, p) => s + p.total_assigned, 0), 1) * 100
            )
          : 0,
        total_enquiries: performers.reduce((s, p) => s + p.enquiries, 0),
      };

      return { performers, summary };
    },
    enabled: !!user?.id,
  });
}

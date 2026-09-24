import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * True when the current user is a "procurement approver only" account
 * (e.g. Anuj) — flagged `is_procurement_approver` in profiles AND
 * NOT holding any elevated app-wide role like super_admin / ceo / coo /
 * managers. Those accounts see a locked-down 2-item workspace.
 */
export function useIsApproverOnly(): { loading: boolean; approverOnly: boolean } {
  const { user, profile, roles, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['approver-only-flag', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_procurement_approver, email')
        .eq('id', user!.id)
        .maybeSingle();
      return {
        flag: (data as any)?.is_procurement_approver === true,
        email: ((data as any)?.email || '').toLowerCase(),
      };
    },
  });

  const flag =
    (profile as any)?.is_procurement_approver === true ||
    data?.flag === true ||
    data?.email === 'anujmaurya@gravenautomation.com';

  // Any of these roles = full app (never approver-only)
  const ELEVATED = new Set([
    'super_admin',
    'admin',
    'ceo',
    'coo',
    'sales_manager',
    'procurement_manager',
    'hr',
    'accounts',
    'sales',
    'warehouse',
    'qc',
    'cro',
    'tst',
    'cst',
    'cct',
    'procurement',
  ]);
  const hasOtherRole = (roles || []).some((r: string) => ELEVATED.has(r));

  return {
    loading: loading || isLoading,
    approverOnly: flag && !hasOtherRole,
  };
}

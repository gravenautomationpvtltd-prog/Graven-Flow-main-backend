import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * True when the current user is authorised to approve bulk-price batches
 * (Anuj / CEO / COO / super_admin, or anyone flagged is_procurement_approver).
 */
export function useIsBulkPriceApprover(): boolean {
  const { user, profile, roles, isAdmin } = useAuth();

  const { data } = useQuery({
    queryKey: ['is-bulk-price-approver', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_procurement_approver, email')
        .eq('id', user!.id)
        .maybeSingle();
      return (data as any)?.is_procurement_approver === true
        || (data as any)?.email?.toLowerCase() === 'anujmaurya@gravenautomation.com';
    },
    staleTime: 60_000,
  });

  const roleOk = (roles || []).some((r: string) => ['super_admin', 'coo'].includes(r));
  const flag = (profile as any)?.is_procurement_approver === true
    || (profile as any)?.email?.toLowerCase() === 'anujmaurya@gravenautomation.com';
  return Boolean(isAdmin || roleOk || flag || data);
}

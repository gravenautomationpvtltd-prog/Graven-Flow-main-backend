import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Internal price comparison sheet (RMB cost / landed / list / margin) is
 * restricted. Access = explicit per-user flag `profiles.can_view_price_comparison`,
 * granted from Settings → Users. Top management always has it.
 */
export function useCanViewPriceComparison(): boolean {
  const { user, profile, roles } = useAuth();

  const { data } = useQuery({
    queryKey: ['can-view-price-comparison', user?.id],
    enabled: !!user?.id && (profile as any)?.can_view_price_comparison === undefined,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('can_view_price_comparison')
        .eq('id', user!.id)
        .maybeSingle();
      return (data as any)?.can_view_price_comparison === true;
    },
  });

  const alwaysAllowed = (roles || []).some((r: string) => ['super_admin', 'coo'].includes(r));
  const flag = (profile as any)?.can_view_price_comparison === true || data === true;
  return Boolean(alwaysAllowed || flag);
}

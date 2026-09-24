import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// Returns the currency code the current user prefers to see amounts in.
// Priority: profiles.preferred_currency → tenants.default_currency → 'INR'.
export function useUserCurrency(): string {
  const { user, profile } = useAuth();
  const { data } = useQuery({
    queryKey: ['tenant-default-currency', user?.id],
    enabled: !!user && !(profile as any)?.preferred_currency,
    queryFn: async () => {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id', { _user_id: user!.id });
      if (!tenantId) return 'INR';
      const { data: t } = await supabase.from('tenants').select('default_currency').eq('id', tenantId).single();
      return (t?.default_currency as string) || 'INR';
    },
  });
  return (profile as any)?.preferred_currency || data || 'INR';
}

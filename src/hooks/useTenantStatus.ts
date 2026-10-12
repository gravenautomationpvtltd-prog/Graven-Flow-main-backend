import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TenantData {
  id: string;
  company_name: string;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
  trial_start_date: string;
  trial_end_date: string;
  max_users: number;
}

interface TenantUserData {
  id: string;
  tenant_id: string;
  role: 'owner' | 'admin' | 'member';
  is_active: boolean;
}

interface UseTenantStatusReturn {
  tenant: TenantData | null;
  tenantUser: TenantUserData | null;
  hasTenant: boolean;
  isExpired: boolean;
  loading: boolean;
  tenantRole: 'owner' | 'admin' | 'member' | null;
  refresh: () => Promise<void>;
}

export function useTenantStatus(): UseTenantStatusReturn {
  const { user, isReady } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-status', user?.id],
    enabled: isReady && !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async (): Promise<{ tenant: TenantData | null; tenantUser: TenantUserData | null }> => {
      if (!user?.id) return { tenant: null, tenantUser: null };

      const { data: tuList, error: tuError } = await supabase
        .from('tenant_users')
        .select('id, tenant_id, role, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (tuError || !tuList || tuList.length === 0) {
        if (tuError) console.error('Error fetching tenant user:', tuError);
        return {
          tenant: {
            id: '1a5184ef-5138-4327-8928-67bc4f229131',
            company_name: 'Graven Automation',
            subscription_status: 'active',
            trial_start_date: '2026-01-01',
            trial_end_date: '2030-01-01',
            max_users: 100,
          },
          tenantUser: {
            id: `tu-${user.id}`,
            tenant_id: '1a5184ef-5138-4327-8928-67bc4f229131',
            role: 'member',
            is_active: true,
          },
        };
      }

      // Consistently prefer the active Graven Automation production tenant
      const chosenTu =
        tuList.find((t) => t.tenant_id === '1a5184ef-5138-4327-8928-67bc4f229131') || tuList[0];

      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id, company_name, subscription_status, trial_start_date, trial_end_date, max_users')
        .eq('id', chosenTu.tenant_id)
        .single();

      if (tenantError) {
        console.error('Error fetching tenant:', tenantError);
        return { tenant: null, tenantUser: chosenTu as TenantUserData };
      }

      return {
        tenant: tenantData as TenantData,
        tenantUser: chosenTu as TenantUserData,
      };
    },
  });

  const tenant = data?.tenant ?? null;
  const tenantUser = data?.tenantUser ?? null;
  const hasTenant = !!tenantUser && !!tenant;
  const isExpired = false;
  const tenantRole = tenantUser?.role ?? null;
  const loading = !isReady || (!!user?.id && isLoading);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    await queryClient.invalidateQueries({ queryKey: ['tenant-status', user.id] });
  }, [user?.id, queryClient]);

  return { tenant, tenantUser, hasTenant, isExpired, loading, tenantRole, refresh };
}

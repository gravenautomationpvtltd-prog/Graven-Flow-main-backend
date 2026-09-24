import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [tenantUser, setTenantUser] = useState<TenantUserData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchedForUserRef = useRef<string | null>(null);

  const fetchTenantStatus = useCallback(async (userId: string) => {
    fetchedForUserRef.current = userId;
    try {
      const { data: tuData, error: tuError } = await supabase
        .from('tenant_users')
        .select('id, tenant_id, role, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (tuError) {
        console.error('Error fetching tenant user:', tuError);
        return;
      }

      if (!tuData) {
        setTenantUser(null);
        setTenant(null);
        return;
      }

      setTenantUser(tuData as TenantUserData);

      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id, company_name, subscription_status, trial_start_date, trial_end_date, max_users')
        .eq('id', tuData.tenant_id)
        .single();

      if (tenantError) {
        console.error('Error fetching tenant:', tenantError);
        return;
      }

      setTenant(tenantData as TenantData);
    } catch (err) {
      console.error('Unexpected error in useTenantStatus:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;

    if (!user) {
      setTenant(null);
      setTenantUser(null);
      setLoading(false);
      fetchedForUserRef.current = null;
      return;
    }

    if (fetchedForUserRef.current === user.id && tenant && tenantUser) {
      return;
    }

    setLoading(true);
    fetchTenantStatus(user.id);
  }, [user?.id, isReady, fetchTenantStatus]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    await fetchTenantStatus(user.id);
  }, [user, fetchTenantStatus]);

  const hasTenant = !!tenantUser && !!tenant;

  const isExpired = (() => {
    if (!tenant) return false;
    const status = tenant.subscription_status;
    if (status === 'expired' || status === 'cancelled') return true;
    if (status === 'trial') {
      return new Date(tenant.trial_end_date) < new Date();
    }
    return false;
  })();

  const tenantRole = tenantUser?.role ?? null;

  return { tenant, tenantUser, hasTenant, isExpired, loading, tenantRole, refresh };
}

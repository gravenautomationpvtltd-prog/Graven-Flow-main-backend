import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantStatus } from './useTenantStatus';
import { toast } from 'sonner';

interface TenantMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  is_active: boolean;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export function useTenantMembers() {
  const { tenant } = useTenantStatus();
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('tenant_users')
      .select('id, user_id, role, is_active, profiles:user_id(full_name, email, avatar_url)')
      .eq('tenant_id', tenant.id)
      .order('role');

    if (!error && data) {
      const mapped = data.map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        role: d.role,
        is_active: d.is_active,
        full_name: d.profiles?.full_name ?? null,
        email: d.profiles?.email ?? null,
        avatar_url: d.profiles?.avatar_url ?? null,
      }));
      setMembers(mapped);
    }
    setLoading(false);
  }, [tenant?.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const updateRole = async (memberId: string, newRole: 'owner' | 'admin' | 'member') => {
    const { error } = await supabase
      .from('tenant_users')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) {
      toast.error('Failed to update role');
    } else {
      toast.success('Role updated');
      fetchMembers();
    }
  };

  const toggleActive = async (memberId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('tenant_users')
      .update({ is_active: !isActive })
      .eq('id', memberId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(isActive ? 'Member deactivated' : 'Member reactivated');
      fetchMembers();
    }
  };

  return { members, loading, updateRole, toggleActive, refetch: fetchMembers };
}

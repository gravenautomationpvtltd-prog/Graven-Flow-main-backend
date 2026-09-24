import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type Profile = Database['public']['Tables']['profiles']['Row'];
type UserRole = Database['public']['Tables']['user_roles']['Row'];
type AppRole = Database['public']['Enums']['app_role'];

export interface UserWithRoles extends Profile {
  roles: AppRole[];
}

export function useUsersWithRoles() {
  return useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      // Get current user's tenant_id for isolation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const tenantId = tenantUser?.tenant_id;

      // Fetch profiles filtered by tenant
      let profilesQuery = supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (tenantId) {
        profilesQuery = profilesQuery.eq('tenant_id', tenantId);
      }

      const { data: profiles, error: profilesError } = await profilesQuery;
      if (profilesError) throw profilesError;

      // Fetch roles only for these users
      const userIds = (profiles || []).map(p => p.id);
      let roles: UserRole[] = [];
      if (userIds.length > 0) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('*')
          .in('user_id', userIds);
        if (rolesError) throw rolesError;
        roles = rolesData || [];
      }

      const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => ({
        ...profile,
        roles: roles
          .filter(role => role.user_id === profile.id)
          .map(role => role.role),
      }));

      return usersWithRoles;
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      email, 
      password, 
      fullName, 
      role, 
      officeId 
    }: { 
      email: string; 
      password: string; 
      fullName: string; 
      role: AppRole;
      officeId?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to create users');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, fullName, role, officeId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      return result.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('User created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create user: ${error.message}`);
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      roles 
    }: { 
      userId: string; 
      roles: AppRole[];
    }) => {
      // Delete existing roles
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Insert new roles
      if (roles.length > 0) {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(roles.map(role => ({ user_id: userId, role })));

        if (insertError) throw insertError;
      }

      return { userId, roles };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('User roles updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update roles: ${error.message}`);
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      isActive,
      employmentStatus,
    }: { 
      userId: string; 
      isActive: boolean;
      employmentStatus?: string;
    }) => {
      const updateData: Record<string, any> = { is_active: isActive };
      if (employmentStatus) {
        updateData.employment_status = employmentStatus;
      }
      // When reactivating, clear exit fields
      if (isActive) {
        updateData.employment_status = 'active';
        updateData.exit_date = null;
        updateData.exit_reason = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;
      return { userId, isActive };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['employees-with-details'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-profile'] });
      const msg = variables.isActive ? 'User activated' : 'User status updated';
      toast.success(msg);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update user status: ${error.message}`);
    },
  });
}

export function useUpdateLeadAssignmentOptOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      optOut 
    }: { 
      userId: string; 
      optOut: boolean;
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ lead_assignment_opt_out: optOut })
        .eq('id', userId);

      if (error) throw error;
      return { userId, optOut };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success(variables.optOut ? 'User excluded from lead assignment' : 'User included in lead assignment');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update lead assignment: ${error.message}`);
    },
  });
}

export function useOffices() {
  return useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offices')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to reset passwords');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, email }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send password reset email');
      }

      return result;
    },
    onSuccess: () => {
      toast.success('Password reset email sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send password reset email');
    },
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      full_name,
      phone,
      office_id,
      manager_id,
    }: {
      userId: string;
      full_name: string;
      phone?: string | null;
      office_id?: string | null;
      manager_id?: string | null;
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name,
          phone,
          office_id,
          manager_id,
        })
        .eq('id', userId);

      if (error) throw error;
      return { userId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('User details updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update user: ${error.message}`);
    },
  });
}

export function useSetProtectedOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, isProtected }: { userId: string; isProtected: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_protected_owner: isProtected } as any)
        .eq('id', userId);
      if (error) throw error;
      // When marking protected, auto-lock all their currently assigned customers
      if (isProtected) {
        const { error: lockErr } = await supabase
          .from('customers')
          .update({ owner_locked: true } as any)
          .eq('assigned_sales_id', userId)
          .eq('owner_locked', false);
        if (lockErr) throw lockErr;
      }
      return { userId, isProtected };
    },
    onSuccess: ({ isProtected }) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(isProtected ? 'Marked as protected owner' : 'Protection removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update protection: ${error.message}`);
    },
  });
}

/** Grants/revokes access to the internal price comparison sheet. */
export function useSetPriceComparisonAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, allowed }: { userId: string; allowed: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ can_view_price_comparison: allowed } as any)
        .eq('id', userId);
      if (error) throw error;
      return { userId, allowed };
    },
    onSuccess: ({ allowed }) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['can-view-price-comparison'] });
      toast.success(allowed ? 'Comparison sheet access granted' : 'Comparison sheet access revoked');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update access: ${error.message}`);
    },
  });
}


export function useUserSalary(userId?: string) {
  return useQuery({
    queryKey: ['user-salary', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('employee_salaries')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useUpdateUserSalary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      base_salary,
    }: {
      userId: string;
      base_salary: number;
    }) => {
      // Upsert salary record
      const { error } = await supabase
        .from('employee_salaries')
        .upsert({
          user_id: userId,
          base_salary,
          effective_from: new Date().toISOString().split('T')[0],
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
      return { userId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-salary', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['employee-salaries'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update salary: ${error.message}`);
    },
  });
}

export function useUpdateUserEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      newEmail,
    }: {
      userId: string;
      newEmail: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to update emails');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, newEmail }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update email');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('User email updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update email');
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to delete users');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('User deleted permanently');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete user');
    },
  });
}

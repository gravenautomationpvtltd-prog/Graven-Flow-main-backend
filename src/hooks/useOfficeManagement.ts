import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';

type Office = Database['public']['Tables']['offices']['Row'];
type OfficeInsert = Database['public']['Tables']['offices']['Insert'];
type OfficeLocation = Database['public']['Enums']['office_location'];

export function useOfficesManagement() {
  return useQuery({
    queryKey: ['offices-management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offices')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Office[];
    },
  });
}

export function useCreateOffice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (office: Omit<OfficeInsert, 'id' | 'created_at' | 'updated_at'>) => {
      await ensureFreshSession();
      const tenantId = await requireTenantId();
      const { data, error } = await supabase
        .from('offices')
        .insert({ ...office, tenant_id: tenantId } as any)
        .select();

      if (error) throw error;
      return data?.[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offices-management'] });
      queryClient.invalidateQueries({ queryKey: ['offices'] });
      toast.success('Office created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create office: ${error.message}`);
    },
  });
}

export function useUpdateOffice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      ...updates 
    }: { 
      id: string; 
      name?: string;
      location?: OfficeLocation;
      address?: string | null;
      phone?: string | null;
      opening_time?: string | null;
      closing_time?: string | null;
    }) => {
      const { error } = await supabase
        .from('offices')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return { id, ...updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offices-management'] });
      queryClient.invalidateQueries({ queryKey: ['offices'] });
      toast.success('Office updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update office: ${error.message}`);
    },
  });
}

export function useDeleteOffice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('offices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offices-management'] });
      queryClient.invalidateQueries({ queryKey: ['offices'] });
      toast.success('Office deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete office: ${error.message}`);
    },
  });
}

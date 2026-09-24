import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LeadConfig {
  assignable_roles: string[];
  include_managers: boolean;
}

const DEFAULT_CONFIG: LeadConfig = {
  assignable_roles: ['sales'],
  include_managers: false,
};

export function useLeadConfig() {
  return useQuery({
    queryKey: ['lead-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('config')
        .eq('integration_type', 'lead_config')
        .single();

      if (error) {
        console.error('Error fetching lead config:', error);
        return DEFAULT_CONFIG;
      }

      const config = data?.config as unknown as LeadConfig | null;
      return config || DEFAULT_CONFIG;
    },
  });
}

export function useUpdateLeadConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: LeadConfig) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase
        .from('integration_settings')
        .update({ 
          config: config as any,
          updated_at: new Date().toISOString(),
        })
        .eq('integration_type', 'lead_config');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-config'] });
      toast.success('Lead assignment roles updated');
    },
    onError: (error) => {
      console.error('Error updating lead config:', error);
      toast.error('Failed to update lead assignment roles');
    },
  });
}

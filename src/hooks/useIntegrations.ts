import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type IntegrationType = 'indiamart' | 'whatsapp' | 'justdial' | 'tradeindia' | 'email';
export type IntegrationSyncStatus = 'success' | 'error' | 'pending';

export interface IntegrationSetting {
  id: string;
  integration_type: IntegrationType;
  api_key: string | null;
  api_secret: string | null;
  is_enabled: boolean;
  config: Record<string, any>;
  last_sync_at: string | null;
  sync_interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface IntegrationLog {
  id: string;
  integration_type: IntegrationType;
  status: IntegrationSyncStatus;
  leads_synced: number;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export function useIntegrationSettings() {
  return useQuery({
    queryKey: ['integration-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .order('integration_type');

      if (error) throw error;
      return data as IntegrationSetting[];
    },
  });
}

export function useIntegrationLogs(integrationType?: IntegrationType) {
  return useQuery({
    queryKey: ['integration-logs', integrationType],
    queryFn: async () => {
      let query = supabase
        .from('integration_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (integrationType) {
        query = query.eq('integration_type', integrationType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as IntegrationLog[];
    },
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      integrationType,
      updates,
    }: {
      integrationType: IntegrationType;
      updates: Partial<IntegrationSetting>;
    }) => {
      const { error } = await supabase
        .from('integration_settings')
        .update(updates)
        .eq('integration_type', integrationType);

      if (error) throw error;
      return { integrationType, ...updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-settings'] });
      toast.success('Integration settings updated');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: async ({
      integrationType,
      apiKey,
      config,
    }: {
      integrationType: IntegrationType;
      apiKey?: string;
      config?: Record<string, any>;
    }) => {
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: {
          integration_type: integrationType,
          api_key: apiKey,
          config: config,
        },
      });

      if (error) throw error;
      return data;
    },
  });
}

export function useSyncIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (integrationType: IntegrationType) => {
      let functionName = '';
      
      switch (integrationType) {
        case 'indiamart':
          functionName = 'indiamart-leads';
          break;
        case 'tradeindia':
          functionName = 'tradeindia-leads';
          break;
        default:
          throw new Error(`Manual sync not supported for ${integrationType}`);
      }

      const { data, error } = await supabase.functions.invoke(functionName);

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['integration-settings'] });
      queryClient.invalidateQueries({ queryKey: ['integration-logs'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`Synced ${data.leads_synced || 0} leads`);
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { IntegrationType } from "./useIntegrations";
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';

export interface IntegrationAccount {
  id: string;
  integration_setting_id: string;
  account_name: string;
  account_type: string;
  userid: string | null;
  profile_id: string | null;
  api_key: string;
  is_enabled: boolean;
  last_sync_at: string | null;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useIntegrationAccounts(integrationSettingId?: string) {
  return useQuery({
    queryKey: ['integration-accounts', integrationSettingId],
    queryFn: async () => {
      let query = supabase
        .from('integration_accounts')
        .select('*')
        .order('created_at', { ascending: true });

      if (integrationSettingId) {
        query = query.eq('integration_setting_id', integrationSettingId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as IntegrationAccount[];
    },
    enabled: !!integrationSettingId,
  });
}

export function useAllIntegrationAccounts() {
  return useQuery({
    queryKey: ['integration-accounts-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_accounts')
        .select('*, integration_settings:integration_setting_id(integration_type)')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateIntegrationAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (account: {
      integration_setting_id: string;
      account_name: string;
      account_type: string;
      userid?: string;
      profile_id?: string;
      api_key: string;
      config?: Record<string, any>;
    }) => {
      await ensureFreshSession();
      const tenantId = await requireTenantId();
      const { data, error } = await supabase
        .from('integration_accounts')
        .insert({ ...account, tenant_id: tenantId } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['integration-accounts-all'] });
      toast.success('Account added successfully');
    },
    onError: (error) => {
      toast.error(`Failed to add account: ${error.message}`);
    },
  });
}

export function useUpdateIntegrationAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<IntegrationAccount>;
    }) => {
      const { data, error } = await supabase
        .from('integration_accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['integration-accounts-all'] });
      toast.success('Account updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update account: ${error.message}`);
    },
  });
}

export function useDeleteIntegrationAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('integration_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['integration-accounts-all'] });
      toast.success('Account deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete account: ${error.message}`);
    },
  });
}

export function useSyncIntegrationAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, integrationType }: { accountId: string; integrationType: IntegrationType }) => {
      let functionName = '';
      
      switch (integrationType) {
        case 'indiamart':
          functionName = 'indiamart-leads';
          break;
        case 'tradeindia':
          functionName = 'tradeindia-leads';
          break;
        default:
          throw new Error(`Sync not supported for ${integrationType}`);
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { account_id: accountId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['integration-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['integration-logs'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`Synced ${data.leads_synced || 0} leads`);
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });
}

export function useTestIntegrationAccount() {
  return useMutation({
    mutationFn: async ({
      integrationType,
      accountType,
      userid,
      profileId,
      apiKey,
    }: {
      integrationType: IntegrationType;
      accountType: string;
      userid?: string;
      profileId?: string;
      apiKey: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: {
          integration_type: integrationType,
          account_type: accountType,
          userid,
          profile_id: profileId,
          api_key: apiKey,
        },
      });

      if (error) throw error;
      return data;
    },
  });
}

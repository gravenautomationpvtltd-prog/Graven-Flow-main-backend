import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';
import { DEFAULT_MIN_MARGIN_PCT } from '@/lib/pricing';

export interface CompanySetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .order('setting_key');
      
      if (error) throw error;
      return data as CompanySetting[];
    },
  });
}

export function useCompanySetting(settingKey: string) {
  return useQuery({
    queryKey: ['company-setting', settingKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('setting_key', settingKey)
        .maybeSingle();
      
      if (error) throw error;
      return data as CompanySetting | null;
    },
  });
}

export function useUpdateCompanySetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ settingKey, settingValue }: { settingKey: string; settingValue: string }) => {
      await ensureFreshSession();
      // Try update first
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .eq('setting_key', settingKey)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('company_settings')
          .update({ setting_value: settingValue })
          .eq('setting_key', settingKey);
        
        if (error) throw error;
      } else {
        const tenantId = await requireTenantId();
        const { error } = await supabase
          .from('company_settings')
          .insert({ setting_key: settingKey, setting_value: settingValue, tenant_id: tenantId } as any);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      queryClient.invalidateQueries({ queryKey: ['company-setting'] });
      toast.success('Setting updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update setting: ' + error.message);
    },
  });
}

// Helper to get default contact info with fallbacks
export function useDefaultContactInfo() {
  const { data: settings } = useCompanySettings();
  
  const getSettingValue = (key: string, fallback: string): string => {
    const setting = settings?.find(s => s.setting_key === key);
    return setting?.setting_value || fallback;
  };

  return {
    defaultPhone: getSettingValue('default_contact_phone', '7905350134'),
    defaultEmail: getSettingValue('default_contact_email', 'info@gravenautomation.com'),
  };
}

/**
 * Tenant-wide minimum gross margin %. A product's own min_margin_pct
 * overrides this; the app default is 15%.
 */
export const MIN_MARGIN_SETTING_KEY = 'min_margin_pct';

export function useMinMarginPct() {
  const { data, ...rest } = useCompanySetting(MIN_MARGIN_SETTING_KEY);
  const parsed = Number(data?.setting_value);
  return {
    ...rest,
    data: Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MIN_MARGIN_PCT,
  };
}

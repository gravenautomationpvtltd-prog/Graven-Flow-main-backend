import { supabase } from '@/integrations/supabase/client';
import { getUserTenantId } from '@/utils/tenantUtils';

/**
 * The procurement head receives every new/unrouted price request and
 * distributes it to the team. Stored in company_settings so it can change
 * without a code deploy.
 */
export async function getProcurementHeadId(): Promise<string | null> {
  try {
    const tenantId = await getUserTenantId();
    if (!tenantId) return null;
    const { data } = await supabase
      .from('company_settings')
      .select('setting_value')
      .eq('tenant_id', tenantId)
      .eq('setting_key', 'procurement_head_user_id')
      .maybeSingle();
    return (data as any)?.setting_value || null;
  } catch {
    return null;
  }
}

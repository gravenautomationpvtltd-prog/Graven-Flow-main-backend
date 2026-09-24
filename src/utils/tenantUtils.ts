import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches the current user's tenant_id via RPC.
 * Used when inserting into tables that require tenant_id.
 */
export async function getUserTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
  return data as string | null;
}

/**
 * Strict variant – throws if tenant_id cannot be resolved.
 * Use this in every INSERT that requires tenant_id so users see a clear
 * message instead of a cryptic RLS violation.
 */
export async function requireTenantId(): Promise<string> {
  const tenantId = await getUserTenantId();
  if (!tenantId) {
    throw new Error('NO_ORGANIZATION: Your account is not linked to an organization. Please contact your admin.');
  }
  return tenantId;
}

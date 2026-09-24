import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures a valid session exists before performing database mutations.
 * Uses getUser() for server-side JWT validation (not cached getSession()).
 * If the token is expired, forces a refresh and re-validates.
 * Call this at the start of every mutationFn that writes to the database.
 */
export async function ensureFreshSession(): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    // Token is invalid/expired — force refresh
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      throw new Error('Session expired. Please log in again.');
    }

    // Re-validate after refresh
    const { data: { user: refreshedUser }, error: reCheckError } = await supabase.auth.getUser();
    if (reCheckError || !refreshedUser) {
      throw new Error('Session expired. Please log in again.');
    }
  }
}

/**
 * Detects RLS / permission-denied errors from Supabase responses.
 */
export function isPermissionError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  const code = (err?.code || '').toString();
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level') ||
    msg.includes('jwt') ||
    msg.includes('not authenticated')
  );
}

/**
 * Runs a Supabase mutation with auto-retry on RLS/permission failures.
 * Forces a session refresh and retries once. This silently heals stale-JWT
 * cases (e.g. user's tenant_users membership was just (re)activated).
 */
export async function runWithSessionRetry<T>(
  fn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  await ensureFreshSession();
  let result = await fn();
  if (result.error && isPermissionError(result.error)) {
    try {
      await supabase.auth.refreshSession();
      await ensureFreshSession();
    } catch {
      // fall through and return original error
    }
    result = await fn();
  }
  return result;
}

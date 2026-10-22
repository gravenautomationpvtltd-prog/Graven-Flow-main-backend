import { supabase } from '@/integrations/supabase/client';

export const MAX_PERSISTED_LEAD_IDS = 50;
const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry {
  ids: string[];
  expiresAt: number;
}

const userLeadIdsCache = new Map<string, CacheEntry>();

export function clearLeadPersistenceCache(): void {
  userLeadIdsCache.clear();
}

/**
 * Resolves lead IDs associated with a user via quotations, qualification,
 * or assignment history (last 30 days), capped at MAX_PERSISTED_LEAD_IDS.
 * This guarantees leads remain visible when status changes or reassignments occur,
 * while preventing oversized query URLs from triggering HTTP 400 Bad Request errors.
 *
 * Performance: Cached in-memory for 30 seconds to prevent firing 4 redundant DB queries
 * on every page change, filter toggle, or dashboard refresh for the same user.
 */
export async function fetchUserAssociatedLeadIds(userId: string): Promise<string[]> {
  if (!userId) return [];

  // Return cached result if still valid
  const cached = userLeadIdsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ids;
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const [quotationsRes, historyRes, qualRes, ordersRes] = await Promise.all([
      supabase
        .from('quotations')
        .select('lead_id')
        .eq('created_by', userId)
        .is('deleted_at', null)
        .not('lead_id', 'is', null)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(MAX_PERSISTED_LEAD_IDS),
      supabase
        .from('lead_assignment_history')
        .select('lead_id')
        .or(`assigned_from.eq.${userId},assigned_to.eq.${userId}`)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(MAX_PERSISTED_LEAD_IDS),
      supabase
        .from('lead_qualification')
        .select('lead_id')
        .eq('qualified_by', userId)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(MAX_PERSISTED_LEAD_IDS),
      supabase
        .from('sales_orders')
        .select('lead_id')
        .eq('created_by', userId)
        .not('lead_id', 'is', null)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(MAX_PERSISTED_LEAD_IDS),
    ]);

    const leadIds = new Set<string>();
    (quotationsRes.data || []).forEach((q: any) => {
      if (q.lead_id) leadIds.add(q.lead_id);
    });
    (historyRes.data || []).forEach((h: any) => {
      if (h.lead_id) leadIds.add(h.lead_id);
    });
    (qualRes.data || []).forEach((ql: any) => {
      if (ql.lead_id) leadIds.add(ql.lead_id);
    });
    (ordersRes.data || []).forEach((o: any) => {
      if (o.lead_id) leadIds.add(o.lead_id);
    });

    const result = Array.from(leadIds).slice(0, MAX_PERSISTED_LEAD_IDS);
    userLeadIdsCache.set(userId, {
      ids: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return result;
  } catch (err) {
    console.warn('[LeadPersistence] Error fetching user associated leads:', err);
    return [];
  }
}

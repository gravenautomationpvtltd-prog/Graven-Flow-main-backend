import { supabase } from '@/integrations/supabase/client';

export type ActivityAction = 'create' | 'update' | 'delete' | 'view' | 'export' | 'login' | 'logout';

export type EntityType = 
  | 'lead' 
  | 'customer' 
  | 'order' 
  | 'invoice' 
  | 'quotation' 
  | 'task' 
  | 'dispatch' 
  | 'product' 
  | 'supplier' 
  | 'purchase_order'
  | 'grn'
  | 'user'
  | 'report'
  | 'cro_assignment';

interface LogActivityParams {
  action: ActivityAction;
  entityType: EntityType;
  entityId?: string;
  entityName?: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  const { action, entityType, entityId, entityName, changes, metadata } = params;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('Cannot log activity: no authenticated user');
      return;
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      entity_name: entityName || null,
      changes: changes ? JSON.stringify(changes) : null,
      metadata: metadata || {},
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch (error) {
    // Silently fail - don't break the main operation
    console.error('Failed to log activity:', error);
  }
}

// Helper to compute changes between two objects
export function computeChanges(
  before: Record<string, any>,
  after: Record<string, any>,
  fieldsToTrack?: string[]
): { before: Record<string, any>; after: Record<string, any> } | null {
  const changedBefore: Record<string, any> = {};
  const changedAfter: Record<string, any> = {};

  const fields = fieldsToTrack || Object.keys(after);

  for (const field of fields) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      changedBefore[field] = before[field];
      changedAfter[field] = after[field];
    }
  }

  if (Object.keys(changedAfter).length === 0) {
    return null;
  }

  return { before: changedBefore, after: changedAfter };
}

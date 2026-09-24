import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { logActivity } from '@/lib/activity-logger';
import { ensureFreshSession, isPermissionError } from '@/utils/sessionGuard';
import { useVertical } from '@/contexts/VerticalContext';

/**
 * Resolves the current user's tenant_id directly from tenant_users (live, not cached).
 * Throws NO_ORGANIZATION if missing, so the UI can show a friendly message.
 */
async function resolveActiveTenantId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Session expired. Please log in again.');

  const { data: tu } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!tu?.tenant_id) {
    throw new Error('NO_ORGANIZATION');
  }
  return tu.tenant_id as string;
}

/**
 * Shared, hardened lead-insert helper. Used by useCreateLead and by
 * non-hook lead creation paths (CST repeat enquiry, etc.) so they all
 * benefit from the same session refresh + RLS retry behaviour.
 *
 * - Ensures a fresh session
 * - Resolves tenant_id from live tenant_users
 * - On a permission/RLS error, refreshes the session and retries once
 */
const VALID_LEAD_SOURCES = new Set([
  'indiamart','justdial','website','whatsapp','email','referral','manual','tradeindia','cro_followup',
]);

export async function safeInsertLead(
  payload: Record<string, any>,
  _options: { select?: string } = {}
): Promise<any> {
  await ensureFreshSession();
  const tenantId = payload.tenant_id || (await resolveActiveTenantId());

  // Pre-generate the lead id client-side so we never depend on reading the row
  // back under RLS (the lead may be auto-reassigned by triggers immediately).
  const leadId: string =
    payload.id ||
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto as any).randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  // Normalise source to a valid enum value (safety net — backend also guards)
  const rawSource = typeof payload.source === 'string' ? payload.source.toLowerCase() : '';
  const safeSource = VALID_LEAD_SOURCES.has(rawSource) ? rawSource : 'manual';

  const rpcPayload = { ...payload, id: leadId, tenant_id: tenantId, source: safeSource };

  const callRpc = () =>
    (supabase as any).rpc('create_lead_secure', { payload: rpcPayload });

  let { data, error } = await callRpc();

  if (error && isPermissionError(error)) {
    try {
      await supabase.auth.refreshSession();
      await ensureFreshSession();
    } catch {
      /* fall through */
    }
    ({ data, error } = await callRpc());
  }

  if (error) {
    // Surface the exact failure cause to the console so we can diagnose
    // generic "Couldn't create the lead" toasts without guessing.
    // eslint-disable-next-line no-console
    console.error('[safeInsertLead] create_lead_secure failed:', {
      code: (error as any)?.code,
      message: (error as any)?.message,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
      payload: rpcPayload,
    });
    throw error;
  }
  return { ...rpcPayload, id: (data as string) || leadId };
}

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadUpdate = Database['public']['Tables']['leads']['Update'];
type LeadStatus = Database['public']['Enums']['lead_status'];
type LeadSource = Database['public']['Enums']['lead_source'];
type EscalationLevel = Database['public']['Enums']['escalation_level'];
type EnquiryStatus = Database['public']['Enums']['enquiry_status'];

export interface LeadWithCustomer extends Lead {
  customer?: Database['public']['Tables']['customers']['Row'] | null;
  assigned_user?: Database['public']['Tables']['profiles']['Row'] | null;
}

export type LeadSortOption = 
  | 'newest' 
  | 'oldest' 
  | 'last_activity' 
  | 'expected_close' 
  | 'highest_value' 
  | 'lowest_value';

export interface LeadFilters {
  // Single value filters (legacy support)
  status?: LeadStatus;
  source?: LeadSource;
  escalationLevel?: EscalationLevel;
  enquiryStatus?: EnquiryStatus;
  
  // Multi-value filters (new)
  statuses?: LeadStatus[];
  sources?: LeadSource[];
  escalationLevels?: EscalationLevel[];
  enquiryStatuses?: EnquiryStatus[];
  
  assignedTo?: string;
  search?: string;
  customerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: LeadSortOption;
  page?: number;
  pageSize?: number;
  hasEnquiry?: boolean;
  priceMatched?: boolean;
}

export interface LeadsResult {
  data: LeadWithCustomer[];
  totalCount: number;
}

export function useLeads(filters?: LeadFilters) {
  const { activeVerticalId } = useVertical();
  return useQuery({
    staleTime: 2 * 60 * 1000,
    queryKey: ['leads', filters, activeVerticalId],
    queryFn: async (): Promise<LeadsResult> => {
      const page = filters?.page ?? 0;
      const pageSize = filters?.pageSize ?? 50;
      const from = page * pageSize;
      const to = from + pageSize - 1;

      // If there's a search term, first find matching customer IDs
      let matchingCustomerIds: string[] = [];
      if (filters?.search) {
        const searchTerm = filters.search.trim();
        if (searchTerm) {
          const { data: matchingCustomers } = await supabase
            .from('customers')
            .select('id')
            .or(`company_name.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%`)
            .limit(500);
          
          matchingCustomerIds = matchingCustomers?.map(c => c.id) ?? [];
        }
      }

      // Helper function to apply filters to a query
      const applyFilters = (query: any) => {
        // Multi-value array filters (new system)
        if (filters?.statuses && filters.statuses.length > 0) {
          query = query.in('status', filters.statuses);
        } else if (filters?.status) {
          // Legacy single value support
          query = query.eq('status', filters.status);
        }

        if (filters?.sources && filters.sources.length > 0) {
          query = query.in('source', filters.sources);
        } else if (filters?.source) {
          query = query.eq('source', filters.source);
        }

        if (filters?.escalationLevels && filters.escalationLevels.length > 0) {
          query = query.in('escalation_level', filters.escalationLevels);
        } else if (filters?.escalationLevel) {
          query = query.eq('escalation_level', filters.escalationLevel);
        }

        if (filters?.enquiryStatuses && filters.enquiryStatuses.length > 0) {
          query = query.in('enquiry_status', filters.enquiryStatuses);
        } else if (filters?.enquiryStatus) {
          query = query.eq('enquiry_status', filters.enquiryStatus);
        }

        if (filters?.assignedTo) {
          query = query.eq('assigned_to', filters.assignedTo);
        }
        if (filters?.customerId) {
          query = query.eq('customer_id', filters.customerId);
        }
        
        // Enhanced search: search in title, customer_query, and matching customer IDs
        if (filters?.search) {
          const searchTerm = filters.search.trim();
          if (searchTerm) {
            if (matchingCustomerIds.length > 0) {
              // Search in lead fields OR match by customer IDs
              query = query.or(
                `title.ilike.%${searchTerm}%,customer_query.ilike.%${searchTerm}%,customer_id.in.(${matchingCustomerIds.join(',')})`
              );
            } else {
              // No matching customers, just search lead fields
              query = query.or(
                `title.ilike.%${searchTerm}%,customer_query.ilike.%${searchTerm}%`
              );
            }
          }
        }
        
        if (filters?.dateFrom) {
          query = query.gte('created_at', filters.dateFrom.toISOString());
        }
        if (filters?.dateTo) {
          // Add one day to include the entire end date
          const endDate = new Date(filters.dateTo);
          endDate.setDate(endDate.getDate() + 1);
          query = query.lt('created_at', endDate.toISOString());
        }
        if (filters?.hasEnquiry !== undefined) {
          query = query.eq('has_enquiry', filters.hasEnquiry);
        }
        if (filters?.priceMatched !== undefined) {
          query = query.eq('enquiry_status', filters.priceMatched ? 'price_matched' : 'quoted');
        }
        if (activeVerticalId) {
          query = query.eq('vertical_id', activeVerticalId);
        }

        return query;
      };

      // First get total count (exclude soft-deleted)
      let countQuery = supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);
      countQuery = applyFilters(countQuery);
      const { count } = await countQuery;

      // Build data query (exclude soft-deleted)
      let query = supabase
        .from('leads')
        .select(`
          *,
          customer:customers(*),
          assigned_user:profiles!leads_assigned_to_fkey(*)
        `)
        .is('deleted_at', null);
      query = applyFilters(query);

      // Apply sorting
      const sortBy = filters?.sortBy ?? 'newest';
      switch (sortBy) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'last_activity':
          query = query.order('last_activity_at', { ascending: false, nullsFirst: false });
          break;
        case 'expected_close':
          query = query.order('expected_close_date', { ascending: true, nullsFirst: false });
          break;
        case 'highest_value':
          query = query.order('estimated_value', { ascending: false, nullsFirst: false });
          break;
        case 'lowest_value':
          query = query.order('estimated_value', { ascending: true, nullsFirst: false });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      // Apply pagination
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) throw error;
      return {
        data: data as LeadWithCustomer[],
        totalCount: count ?? 0,
      };
    },
  });
}

export function useLead(id: string | undefined, includeDeleted = false) {
  return useQuery({
    queryKey: ['lead', id, includeDeleted],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await (supabase as any).rpc('get_lead_detail', {
        p_lead_id: id,
        p_include_deleted: includeDeleted,
      });

      if (error) throw new Error(error.message || 'Failed to load lead');
      return (data ?? null) as LeadWithCustomer | null;
    },
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: Omit<LeadInsert, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>) => {
      // Hardened path: live tenant resolution + auto-retry on RLS/permission errors.
      return await safeInsertLead(lead as Record<string, any>);
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });

      // Dual-role aware toast: if the creator has the LQT (cro) role,
      // the trigger routes the lead to their own LQT inbox first.
      let landedInOwnLqt = false;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);
          const hasLqt = (roles ?? []).some((r: any) => r.role === 'cro');
          landedInOwnLqt = hasLqt && (data as any)?.assigned_to === user.id;
        }
      } catch {
        /* non-blocking */
      }

      toast.success(
        landedInOwnLqt
          ? 'Lead created — routed to your LQT inbox for qualification.'
          : 'Lead created successfully'
      );
      logActivity({
        action: 'create',
        entityType: 'lead',
        entityId: data.id,
        entityName: data.title || 'Untitled Lead',
      });
    },
    onError: (error: Error) => {
      const msg = error.message || '';
      const lower = msg.toLowerCase();
      let message: string;

      if (msg.includes('NO_ORGANIZATION') || lower.includes('no organization found') || lower.includes('no_organization')) {
        message = "Your account isn't fully set up yet. Please refresh the page or contact your admin.";
      } else if (lower.includes('session expired') || lower.includes('jwt') || lower.includes('invalid token') || lower.includes('not authenticated') || lower.includes('not_authenticated')) {
        message = 'Session expired. Please log out and log back in.';
      } else if (lower.includes('violates unique constraint')) {
        if (lower.includes('source') || lower.includes('source_reference')) {
          message = 'This External Reference ID is already used by another lead. Use a unique reference (e.g. WhatsApp message ID, IndiaMART Lead ID) or leave the field blank.';
        } else if (lower.includes('uq_lead_qualification_active')) {
          message = 'This lead already has an active qualification. Refresh the page and try again.';
        } else {
          message = 'A lead with this information already exists.';
        }
      } else if (lower.includes('violates foreign key')) {
        message = 'Invalid customer or assignee selected. Please refresh and try again.';
      } else if (lower.includes('cannot route lead to spt without at least one enquiry item')) {
        message = 'Add at least one enquiry item before this lead can be routed to Sales.';
      } else if (lower.includes('canceling statement due to statement timeout') || lower.includes('timeout')) {
        message = 'The server is busy right now. Please wait a few seconds and try again.';
      } else if (lower.includes('permission denied') || lower.includes('row-level security') || lower.includes('violates row-level')) {
        message = "You don't have permission to create a lead here. Please contact your admin.";
      } else if (lower.includes('network') || lower.includes('failed to fetch')) {
        message = 'Network error. Please check your connection and try again.';
      } else if (msg) {
        // Surface the real backend message instead of a generic fallback so
        // the user (and support) can see what actually went wrong.
        message = `Couldn't create the lead: ${msg}`;
      } else {
        message = "Couldn't create the lead right now. Please try again in a moment.";
      }

      toast.error(message);
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: LeadUpdate & { id: string }) => {
      await ensureFreshSession();
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', data.id] });
      const wasReassignment = 'assigned_to' in (variables as object);
      toast.success(
        wasReassignment
          ? 'Lead reassigned. All details, quotations and history are preserved.'
          : 'Lead updated successfully'
      );
      logActivity({
        action: 'update',
        entityType: 'lead',
        entityId: data.id,
        entityName: data.title || 'Untitled Lead',
      });
    },
    onError: (error: Error) => {
      let message = 'Failed to update lead';
      
      if (error.message.includes('violates foreign key')) {
        message = 'Invalid customer or user selected';
      } else if (error.message.includes('permission denied') || error.message.includes('row-level security')) {
        message = 'You do not have permission to update this lead';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        message = 'Network error. Please check your connection';
      } else {
        message = `Failed to update lead: ${error.message}`;
      }
      
      toast.error(message);
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete using the database function
      const { error } = await supabase.rpc('soft_delete_lead', { lead_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['deleted-leads'] });
      toast.success('Lead moved to trash');
      logActivity({
        action: 'delete',
        entityType: 'lead',
        entityId: id,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to delete lead: ' + error.message);
    },
  });
}

export function useRestoreLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('restore_lead', { lead_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['deleted-leads'] });
      toast.success('Lead restored successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to restore lead: ' + error.message);
    },
  });
}

export function useDeletedLeads() {
  return useQuery({
    queryKey: ['deleted-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          customer:customers(*),
          assigned_user:profiles!leads_assigned_to_fkey(*)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return data as LeadWithCustomer[];
    },
  });
}

export function usePermanentDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('hard_delete_lead', { lead_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['deleted-leads'] });
      toast.success('Lead permanently deleted');
      logActivity({
        action: 'delete',
        entityType: 'lead',
        entityId: id,
        metadata: { permanent: true },
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to permanently delete lead: ' + error.message);
    },
  });
}

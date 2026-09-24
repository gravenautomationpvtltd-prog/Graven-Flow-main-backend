import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activity-logger';

export interface CROAssignment {
  id: string;
  cro_user_id: string;
  customer_id: string;
  tenant_id: string;
  assigned_at: string;
  last_contacted_at: string | null;
  scheduled_callback_at: string | null;
  status: string;
  notes: string | null;
  contacted_count: number;
  created_at: string;
  customer: {
    id: string;
    company_name: string;
    contact_person: string | null;
    phone: string;
    email: string | null;
    city: string | null;
    state: string | null;
    segment: string | null;
    assigned_sales_id: string | null;
    assigned_sales?: { full_name: string } | null;
  };
}

const CRO_QUERY_KEY = 'cro-assignments-v2';

async function fetchAllAssignments(userId: string): Promise<CROAssignment[]> {
  const PAGE_SIZE = 1000;
  const allData: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('cro_customer_assignments')
      .select(`
        *,
        customer:customers!inner (
          id,
          company_name,
          contact_person,
          phone,
          email,
          city,
          state,
          segment,
          assigned_sales_id,
          assigned_sales:profiles!customers_assigned_sales_id_fkey (full_name)
        )
      `)
      .eq('cro_user_id', userId)
      .order('assigned_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (data && data.length > 0) allData.push(...data);
    hasMore = (data?.length ?? 0) === PAGE_SIZE;
    page++;
  }

  // Dedupe by id
  const seen = new Set<string>();
  const deduped = allData.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // Sort by status priority
  const statusPriority: Record<string, number> = {
    enquiry_received: 0,
    contacted: 1,
    no_response: 2,
    pending: 3,
  };

  return deduped.sort((a, b) => {
    const pa = statusPriority[a.status] ?? 3;
    const pb = statusPriority[b.status] ?? 3;
    if (pa !== pb) return pa - pb;
    const dateA = a.last_contacted_at || a.assigned_at;
    const dateB = b.last_contacted_at || b.assigned_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  }) as unknown as CROAssignment[];
}

export function useCROAssignments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastFetchedAt = useRef<Date | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced invalidation — max once per 30s
  const debouncedInvalidate = useCallback(() => {
    if (debounceTimer.current) return; // already scheduled
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      queryClient.invalidateQueries({ queryKey: [CRO_QUERY_KEY, user?.id] });
    }, 30000);
  }, [queryClient, user?.id]);

  // Realtime subscription for auto-invalidation (throttled)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('cro-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cro_customer_assignments', filter: `cro_user_id=eq.${user.id}` },
        () => {
          debouncedInvalidate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [user?.id, debouncedInvalidate]);

  const query = useQuery({
    queryKey: [CRO_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const result = await fetchAllAssignments(user.id);
      lastFetchedAt.current = new Date();
      return result;
    },
    enabled: !!user?.id,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { ...query, lastFetchedAt: lastFetchedAt.current };
}

export function useUpdateCROAssignment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, status, notes, last_contacted_at, contacted_count, scheduled_callback_at }: {
      id: string;
      status?: string;
      notes?: string;
      last_contacted_at?: string;
      contacted_count?: number;
      scheduled_callback_at?: string | null;
    }) => {
      const updates: Record<string, unknown> = {};
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (last_contacted_at) updates.last_contacted_at = last_contacted_at;
      if (contacted_count !== undefined) updates.contacted_count = contacted_count;
      if (scheduled_callback_at !== undefined) updates.scheduled_callback_at = scheduled_callback_at;

      const { error } = await supabase
        .from('cro_customer_assignments')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return { id, ...updates };
    },
    onMutate: async (variables) => {
      const queryKey = [CRO_QUERY_KEY, user?.id];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CROAssignment[]>(queryKey);

      if (previous) {
        queryClient.setQueryData<CROAssignment[]>(queryKey, old =>
          (old || []).map(a => {
            if (a.id !== variables.id) return a;
            return {
              ...a,
              ...(variables.status && { status: variables.status }),
              ...(variables.notes !== undefined && { notes: variables.notes }),
              ...(variables.last_contacted_at && { last_contacted_at: variables.last_contacted_at }),
              ...(variables.contacted_count !== undefined && { contacted_count: variables.contacted_count }),
              ...(variables.scheduled_callback_at !== undefined && { scheduled_callback_at: variables.scheduled_callback_at }),
            };
          })
        );
      }

      return { previous };
    },
    onSuccess: (_data, variables) => {
      // No invalidation — optimistic update is sufficient
      toast.success('Assignment updated');
      logActivity({
        action: 'update',
        entityType: 'cro_assignment',
        entityId: variables.id,
        entityName: variables.status ? `Status → ${variables.status}` : undefined,
        metadata: { status: variables.status, contacted_count: variables.contacted_count },
      });
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData([CRO_QUERY_KEY, user?.id], context.previous);
      }
      toast.error('Failed to update assignment');
    },
  });
}

export function useUpdateCustomerSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, segment }: { customerId: string; segment: string }) => {
      const { error } = await supabase
        .from('customers')
        .update({ segment, segment_locked: true } as any)
        .eq('id', customerId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [CRO_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer segment updated');
      logActivity({
        action: 'update',
        entityType: 'customer',
        entityId: variables.customerId,
        entityName: `Segment → ${variables.segment}`,
        metadata: { segment: variables.segment },
      });
    },
    onError: () => {
      toast.error('Failed to update segment');
    },
  });
}

export function useDistributeCustomers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tenantId, staleDays = 60 }: { tenantId: string; staleDays?: number }) => {
      const { data, error } = await supabase.rpc('distribute_customers_to_cros', {
        p_tenant_id: tenantId,
        p_stale_days: staleDays,
      });
      if (error) throw error;
      return data as { status: string; assigned_count: number; cro_count: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [CRO_QUERY_KEY] });
      if (data && typeof data === 'object' && 'assigned_count' in data) {
        toast.success(`Distributed ${(data as any).assigned_count} customers to CROs`);
      } else {
        toast.success('Distribution complete');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to distribute customers');
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Paged, server-side filtered price request queue.
 *
 * The old implementation fetched every row with 5 nested joins which
 * timed out (57014) once the backlog grew past a few thousand rows.
 * Here we fetch a slim page and hydrate related labels in small
 * follow-up lookups.
 */

const sel = (s: string): string => s;

export type QueueStatus = 'all' | 'pending' | 'in_progress' | 'resolved' | 'no_price' | 'matched';

export interface QueueFilters {
  status: QueueStatus;
  search: string;
  assignedTo: string; // 'all' | 'me' | 'unassigned' | uuid
  priority: string; // 'all' | low | normal | high | urgent
  page: number;
  pageSize: number;
}

export interface QueueRow {
  id: string;
  lead_id: string | null;
  enquiry_item_id: string | null;
  status: string;
  priority: string;
  requested_at: string;
  created_at: string;
  resolved_at: string | null;
  resolved_price: number | null;
  target_rate: number | null;
  target_matched_at: string | null;
  sales_outcome: string | null;
  current_round: number | null;
  tat_deadline: string | null;
  assigned_to: string | null;
  requested_by: string | null;
  last_priced_by: string | null;
  // hydrated
  product_text: string;
  brand: string | null;
  quantity: number | null;
  customer_name: string;
  lead_title: string;
  assigned_to_name: string | null;
  requested_by_name: string | null;
}

async function searchEnquiryItemIds(search: string): Promise<string[]> {
  const { data } = await supabase
    .from('enquiry_items')
    .select('id')
    .ilike('product_query_text', `%${search}%`)
    .limit(500);
  return (data || []).map((r: any) => r.id);
}

export function usePriceRequestQueue(filters: QueueFilters, currentUserId?: string) {
  return useQuery({
    queryKey: ['price-request-queue', filters, currentUserId],
    staleTime: 30_000,
    queryFn: async () => {
      let itemIds: string[] | null = null;
      if (filters.search.trim().length >= 2) {
        itemIds = await searchEnquiryItemIds(filters.search.trim());
        if (itemIds.length === 0) return { rows: [] as QueueRow[], total: 0 };
      }

      let q = supabase
        .from('price_requests')
        .select(
          sel(
            'id, lead_id, enquiry_item_id, status, priority, requested_at, created_at, resolved_at, resolved_price, target_rate, target_matched_at, sales_outcome, current_round, tat_deadline, assigned_to, requested_by, last_priced_by'
          ),
          { count: 'exact' }
        )
        .order('requested_at', { ascending: false });

      if (filters.status === 'matched') {
        q = q.not('target_matched_at', 'is', null);
      } else if (filters.status !== 'all') {
        q = q.eq('status', filters.status as any);
      }

      if (filters.priority !== 'all') q = q.eq('priority', filters.priority as any);

      if (filters.assignedTo === 'me' && currentUserId) q = q.eq('assigned_to', currentUserId);
      else if (filters.assignedTo === 'unassigned') q = q.is('assigned_to', null);
      else if (filters.assignedTo === 'to_distribute' && currentUserId)
        q = q.or(`assigned_to.is.null,assigned_to.eq.${currentUserId}`);
      else if (filters.assignedTo !== 'all') q = q.eq('assigned_to', filters.assignedTo);

      if (itemIds) q = q.in('enquiry_item_id', itemIds);

      const from = filters.page * filters.pageSize;
      q = q.range(from, from + filters.pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const base = (data || []) as any[];
      if (base.length === 0) return { rows: [] as QueueRow[], total: count ?? 0 };

      const eiIds = [...new Set(base.map((r) => r.enquiry_item_id).filter(Boolean))] as string[];
      const leadIds = [...new Set(base.map((r) => r.lead_id).filter(Boolean))] as string[];
      const userIds = [
        ...new Set(
          base.flatMap((r) => [r.assigned_to, r.requested_by, r.last_priced_by]).filter(Boolean)
        ),
      ] as string[];

      const [itemsRes, leadsRes, profRes] = await Promise.all([
        eiIds.length
          ? supabase
              .from('enquiry_items')
              .select(sel('id, product_query_text, quantity, target_rate, brand'))
              .in('id', eiIds)
          : Promise.resolve({ data: [] as any[] }),
        leadIds.length
          ? supabase
              .from('leads')
              .select(sel('id, title, customer_id, customers(company_name)'))
              .in('id', leadIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from('profiles').select(sel('id, full_name')).in('id', userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const itemMap = new Map((itemsRes.data || []).map((i: any) => [i.id, i]));
      const leadMap = new Map((leadsRes.data || []).map((l: any) => [l.id, l]));
      const profMap = new Map((profRes.data || []).map((p: any) => [p.id, p.full_name]));

      const rows: QueueRow[] = base.map((r) => {
        const item: any = r.enquiry_item_id ? itemMap.get(r.enquiry_item_id) : null;
        const lead: any = r.lead_id ? leadMap.get(r.lead_id) : null;
        return {
          ...r,
          target_rate: r.target_rate ?? item?.target_rate ?? null,
          product_text:
            item?.product_query_text ||
            (lead?.title ? String(lead.title).replace(/^Requirement for\s*/i, '') : '') ||
            'Item pending description',
          brand: item?.brand ?? null,
          quantity: item?.quantity ?? null,
          customer_name: lead?.customers?.company_name || 'Unknown',
          lead_title: lead?.title || '',
          assigned_to_name: r.assigned_to ? profMap.get(r.assigned_to) || null : null,
          requested_by_name: r.requested_by ? profMap.get(r.requested_by) || null : null,
        } as QueueRow;
      });

      return { rows, total: count ?? rows.length };
    },
  });
}

/** Lightweight count-only KPIs — never depend on the big list query. */
export function usePriceRequestKpis(currentUserId?: string) {
  return useQuery({
    queryKey: ['price-request-kpis', currentUserId],
    staleTime: 60_000,
    queryFn: async () => {
      const countOf = async (build: (q: any) => any) => {
        const { count, error } = await build(
          supabase.from('price_requests').select('id', { count: 'exact', head: true })
        );
        if (error) throw error;
        return count ?? 0;
      };

      const nowIso = new Date().toISOString();
      const [pending, urgent, overdue, matched, mine, resolved] = await Promise.all([
        countOf((q) => q.eq('status', 'pending')),
        countOf((q) => q.in('status', ['pending', 'in_progress']).in('priority', ['urgent', 'high'])),
        countOf((q) => q.in('status', ['pending', 'in_progress']).lt('tat_deadline', nowIso)),
        countOf((q) => q.not('target_matched_at', 'is', null)),
        currentUserId
          ? countOf((q) => q.eq('assigned_to', currentUserId).in('status', ['pending', 'in_progress']))
          : Promise.resolve(0),
        countOf((q) => q.eq('status', 'resolved')),
      ]);

      return { pending, urgent, overdue, matched, mine, resolved };
    },
  });
}

/** Procurement-side members available for assignment. */
export function useProcurementMembers() {
  return useQuery({
    queryKey: ['procurement-members'],
    staleTime: 300_000,
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['procurement', 'procurement_manager', 'import_procurement', 'cct']);
      if (error) throw error;
      const ids = [...new Set((roles || []).map((r: any) => r.user_id))];
      if (!ids.length) return [] as { id: string; full_name: string }[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select(sel('id, full_name'))
        .in('id', ids)
        .eq('is_active', true)
        .order('full_name');
      return (profiles || []) as unknown as { id: string; full_name: string }[];
    },
  });
}

export function useAssignPriceRequests() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      userId,
      itemLabels,
    }: {
      ids: string[];
      userId: string | null;
      itemLabels?: string[];
    }) => {
      const { error } = await supabase
        .from('price_requests')
        .update({ assigned_to: userId })
        .in('id', ids);
      if (error) throw error;

      // Tell the assignee what landed in their queue.
      if (userId) {
        const preview = (itemLabels || []).filter(Boolean).slice(0, 3).join(', ');
        await supabase.from('notifications').insert({
          user_id: userId,
          title: `${ids.length} price request${ids.length === 1 ? '' : 's'} assigned to you`,
          message: preview
            ? `${preview}${ids.length > 3 ? ` +${ids.length - 3} more` : ''}`
            : 'Open the procurement queue to arrange pricing.',
          type: 'price_request_assigned',
          link: '/procurement',
        } as any);
      }
      return ids.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ['price-request-queue'] });
      queryClient.invalidateQueries({ queryKey: ['price-request-kpis'] });
      toast.success(`${n} request${n === 1 ? '' : 's'} assigned`);
    },
    onError: (e: Error) => toast.error('Failed to assign: ' + e.message),
  });
}

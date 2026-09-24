import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

export type BIEWorkType = 'vendor_registrations' | 'tenders' | 'website_listings';
export type VendorRegistration = Database['public']['Tables']['vendor_registrations']['Row'];
export type Tender = Database['public']['Tables']['tenders']['Row'];
export type WebsiteListing = Database['public']['Tables']['website_listings']['Row'];

export type BIEPriority = 'low' | 'normal' | 'high' | 'urgent';

export type BIEReviewStatus = 'not_submitted' | 'submitted' | 'approved' | 'rework';

export type BIERow = {
  id: string;
  type: BIEWorkType | 'product_assignments';
  title: string;
  subtitle: string;
  status: string;
  priority: BIEPriority;
  due_date: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  review_status: BIEReviewStatus;
  rework_note: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
  raw: Record<string, unknown>;
};

export const TERMINAL_STATUSES = ['approved', 'rejected', 'awarded', 'lost', 'active', 'removed', 'completed'];

const toRow = (type: BIEWorkType, record: Record<string, unknown>): BIERow => {
  const titleKey = type === 'vendor_registrations' ? 'company_name' : type === 'tenders' ? 'tender_number' : 'listing_title';
  const subtitleKey = type === 'vendor_registrations' ? 'portal_name' : type === 'tenders' ? 'issuing_authority' : 'website_name';
  return {
    id: String(record.id),
    type,
    title: String(record[titleKey] ?? ''),
    subtitle: String(record[subtitleKey] ?? ''),
    status: String(record.status ?? ''),
    priority: (record.priority as BIEPriority) ?? 'normal',
    due_date: (record.due_date as string | null) ?? null,
    assigned_to: (record.assigned_to as string | null) ?? null,
    assigned_by: (record.assigned_by as string | null) ?? null,
    review_status: ((record.review_status as BIEReviewStatus | null) ?? 'not_submitted'),
    rework_note: (record.rework_note as string | null) ?? null,
    completed_at: (record.completed_at as string | null) ?? null,
    created_at: String(record.created_at ?? ''),
    updated_at: (record.updated_at as string | null) ?? null,
    raw: record,
  };
};

export function useBIEWork() {
  return useQuery({
    queryKey: ['bie-work'],
    queryFn: async () => {
      const [registrations, tenders, listings, assignments] = await Promise.all([
        supabase.from('vendor_registrations').select('*').order('created_at', { ascending: false }),
        supabase.from('tenders').select('*').order('created_at', { ascending: false }),
        supabase.from('website_listings').select('*').order('created_at', { ascending: false }),
        supabase
          .from('product_assignments')
          .select('*, product:products(id, name, model_number)')
          .order('created_at', { ascending: false }),
      ]);
      if (registrations.error) throw registrations.error;
      if (tenders.error) throw tenders.error;
      if (listings.error) throw listings.error;
      if (assignments.error) throw assignments.error;

      const assignmentRows: BIERow[] = (assignments.data ?? []).map((record) => {
        const raw = record as unknown as Record<string, unknown>;
        const product = raw.product as { name?: string; model_number?: string } | null;
        return {
          id: String(raw.id),
          type: 'product_assignments' as const,
          title: product?.model_number || product?.name || 'Product',
          subtitle: String(raw.task_type ?? '').replace(/_/g, ' '),
          status: String(raw.status ?? ''),
          priority: (raw.priority as BIEPriority) ?? 'normal',
          due_date: (raw.due_date as string | null) ?? null,
          assigned_to: (raw.assigned_to as string | null) ?? null,
          assigned_by: (raw.assigned_by as string | null) ?? null,
          review_status: ((raw.review_status as BIEReviewStatus | null) ?? 'not_submitted'),
          rework_note: (raw.rework_note as string | null) ?? null,
          completed_at: (raw.completed_at as string | null) ?? null,
          created_at: String(raw.created_at ?? ''),
          updated_at: (raw.updated_at as string | null) ?? null,
          raw,
        };
      });

      const rows: BIERow[] = [
        ...(registrations.data ?? []).map((r) => toRow('vendor_registrations', r as unknown as Record<string, unknown>)),
        ...(tenders.data ?? []).map((r) => toRow('tenders', r as unknown as Record<string, unknown>)),
        ...(listings.data ?? []).map((r) => toRow('website_listings', r as unknown as Record<string, unknown>)),
        ...assignmentRows,
      ];
      return {
        registrations: registrations.data ?? [],
        tenders: tenders.data ?? [],
        listings: listings.data ?? [],
        assignments: assignments.data ?? [],
        rows,
      };
    },
  });
}

export function useBIETeam() {
  const { loading, isBIE, isBIEManager, isAdmin, isManager, isProcurement } = useAuth();
  return useQuery({
    queryKey: ['bie-team'],
    enabled: !loading && (isBIE || isBIEManager || isAdmin || isManager || isProcurement),
    queryFn: async () => {
      const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['bie', 'bie_manager']);
      if (roleError) throw roleError;
      const ids = [...new Set((roleRows ?? []).map((row) => row.user_id))];
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, is_active')
        .in('id', ids)
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBIEHistory(recordId?: string) {
  return useQuery({
    queryKey: ['bie-history', recordId],
    enabled: !!recordId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bie_work_history')
        .select('*')
        .eq('record_id', recordId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

type CreatePayload = {
  table: BIEWorkType;
  values: Record<string, string | number | null>;
  assignedTo: string;
};

async function logHistory(params: {
  table: BIEWorkType;
  recordId: string;
  from?: string | null;
  to?: string | null;
  note?: string | null;
  userId: string;
  tenantId: string;
}) {
  await supabase.from('bie_work_history').insert({
    work_type: params.table,
    record_id: params.recordId,
    from_status: params.from ?? null,
    to_status: params.to ?? null,
    note: params.note ?? null,
    changed_by: params.userId,
    tenant_id: params.tenantId,
  });
}

export function useCreateBIEWork() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ table, values, assignedTo }: CreatePayload) => {
      await ensureFreshSession();
      if (!user) throw new Error('Please sign in again.');
      const tenantId = await requireTenantId();
      const payload = {
        ...values,
        tenant_id: tenantId,
        assigned_to: assignedTo,
        assigned_by: user.id,
      };
      const { data, error } = await supabase.from(table).insert(payload as never).select('id, status').single();
      if (error) throw error;
      const created = data as unknown as { id: string; status: string };
      await logHistory({ table, recordId: created.id, to: created.status, note: 'Created', userId: user.id, tenantId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bie-work'] });
      toast.success('Work added successfully');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateBIEWork() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      table,
      id,
      values,
      previousStatus,
      note,
    }: {
      table: BIEWorkType;
      id: string;
      values: Record<string, string | number | null>;
      previousStatus?: string;
      note?: string;
    }) => {
      await ensureFreshSession();
      const { error } = await supabase
        .from(table)
        .update({ ...values, updated_at: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
      const nextStatus = values.status ? String(values.status) : undefined;
      if (user && nextStatus && previousStatus && nextStatus !== previousStatus) {
        const tenantId = await requireTenantId();
        await logHistory({ table, recordId: id, from: previousStatus, to: nextStatus, note, userId: user.id, tenantId });
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bie-work'] });
      queryClient.invalidateQueries({ queryKey: ['bie-history', variables.id] });
      toast.success('Work updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export type AnyBIETable = BIEWorkType | 'product_assignments';

/** Rows already scoped to the signed-in person's role. */
export function useBIEScopedWork() {
  const { user, isBIEManager } = useAuth();
  const query = useBIEWork();
  const rows = (query.data?.rows ?? []).filter((row) => (isBIEManager ? true : row.assigned_to === user?.id));
  return { ...query, rows, allRows: query.data?.rows ?? [] };
}

/** Staff marks work done -> goes into the manager's review queue. */
export function useSubmitForReview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ table, id, note }: { table: AnyBIETable; id: string; note?: string }) => {
      await ensureFreshSession();
      if (!user) throw new Error('Please sign in again.');
      const { error } = await supabase
        .from(table)
        .update({
          review_status: 'submitted',
          submitted_at: new Date().toISOString(),
          rework_note: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', id);
      if (error) throw error;
      const tenantId = await requireTenantId();
      await supabase.from('bie_work_history').insert({
        work_type: table,
        record_id: id,
        from_status: 'in_progress',
        to_status: 'submitted_for_review',
        note: note ?? null,
        changed_by: user.id,
        tenant_id: tenantId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bie-work'] });
      queryClient.invalidateQueries({ queryKey: ['product-assignments'] });
      toast.success('Sent to your manager for review');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Manager approves the work or sends it back for rework. */
export function useReviewBIEWork() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      table,
      id,
      decision,
      note,
    }: {
      table: AnyBIETable;
      id: string;
      decision: 'approved' | 'rework';
      note?: string;
    }) => {
      await ensureFreshSession();
      if (!user) throw new Error('Please sign in again.');
      const now = new Date().toISOString();
      const { error } = await supabase
        .from(table)
        .update({
          review_status: decision,
          reviewed_by: user.id,
          reviewed_at: now,
          rework_note: decision === 'rework' ? note ?? null : null,
          completed_at: decision === 'approved' ? now : null,
          updated_at: now,
        } as never)
        .eq('id', id);
      if (error) throw error;
      const tenantId = await requireTenantId();
      await supabase.from('bie_work_history').insert({
        work_type: table,
        record_id: id,
        from_status: 'submitted_for_review',
        to_status: decision === 'approved' ? 'approved' : 'sent_back_for_rework',
        note: note ?? null,
        changed_by: user.id,
        tenant_id: tenantId,
      });
    },
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bie-work'] });
      queryClient.invalidateQueries({ queryKey: ['product-assignments'] });
      toast.success(variables.decision === 'approved' ? 'Work approved' : 'Sent back for rework');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Manager-only: hand work to somebody else or change its deadline / priority. */
export function useReassignBIEWork() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      table,
      id,
      assignedTo,
      priority,
      dueDate,
    }: {
      table: AnyBIETable;
      id: string;
      assignedTo?: string;
      priority?: BIEPriority;
      dueDate?: string | null;
    }) => {
      await ensureFreshSession();
      if (!user) throw new Error('Please sign in again.');
      const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (assignedTo) {
        values.assigned_to = assignedTo;
        values.assigned_by = user.id;
      }
      if (priority) values.priority = priority;
      if (dueDate !== undefined) values.due_date = dueDate || null;
      const { error } = await supabase.from(table).update(values as never).eq('id', id);
      if (error) throw error;
      const tenantId = await requireTenantId();
      await supabase.from('bie_work_history').insert({
        work_type: table,
        record_id: id,
        to_status: assignedTo ? 'reassigned' : 'schedule_updated',
        changed_by: user.id,
        tenant_id: tenantId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bie-work'] });
      queryClient.invalidateQueries({ queryKey: ['product-assignments'] });
      toast.success('Updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

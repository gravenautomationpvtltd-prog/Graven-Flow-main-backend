import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type BoqStatus = 'draft' | 'in_progress' | 'ready_for_sales' | 'handed_off' | 'on_hold';
export type BoqFeasibility = 'feasible' | 'not_feasible' | 'needs_clarification';
export type BoqItemCategory = 'vfd' | 'plc' | 'hmi' | 'sensor' | 'motor' | 'panel' | 'cable' | 'accessory' | 'other';

export interface Boq {
  id: string;
  lead_id: string;
  tenant_id: string | null;
  status: BoqStatus;
  assigned_to: string | null;
  technical_notes: string | null;
  feasibility: BoqFeasibility | null;
  feasibility_notes: string | null;
  handoff_to_sales_at: string | null;
  handoff_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  lead?: {
    id: string;
    customer_query: string | null;
    customer?: { company_name: string; contact_person: string | null } | null;
  } | null;
  assignee?: { full_name: string | null } | null;
  items_count?: number;
}

export interface BoqItem {
  id: string;
  boq_id: string;
  product_id: string | null;
  category: BoqItemCategory;
  model_number: string | null;
  manufacturer: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  estimated_unit_price: number | null;
  technical_specs: any;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// List BOQs (TST queue). Filter by status optional.
export function useBoqs(filters?: { status?: BoqStatus[]; assignedTo?: string }) {
  return useQuery({
    queryKey: ['boqs', filters],
    queryFn: async () => {
      let query = supabase
        .from('boqs' as any)
        .select(`
          *,
          lead:leads(id, customer_query, customer:customers(company_name, contact_person)),
          assignee:profiles!boqs_assigned_to_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status?.length) query = query.in('status', filters.status);
      if (filters?.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as Boq[]) || [];
    },
  });
}

export function useBoqByLead(leadId: string | undefined) {
  return useQuery({
    queryKey: ['boq', 'by-lead', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from('boqs' as any)
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return (data as unknown as Boq) || null;
    },
    enabled: !!leadId,
  });
}

export function useBoq(boqId: string | undefined) {
  return useQuery({
    queryKey: ['boq', boqId],
    queryFn: async () => {
      if (!boqId) return null;
      const { data, error } = await supabase
        .from('boqs' as any)
        .select(`
          *,
          lead:leads(id, customer_query, customer:customers(company_name, contact_person, phone, email)),
          assignee:profiles!boqs_assigned_to_fkey(full_name)
        `)
        .eq('id', boqId)
        .single();
      if (error) throw error;
      return data as unknown as Boq;
    },
    enabled: !!boqId,
  });
}

export function useBoqItems(boqId: string | undefined) {
  return useQuery({
    queryKey: ['boq-items', boqId],
    queryFn: async () => {
      if (!boqId) return [];
      const { data, error } = await supabase
        .from('boq_items' as any)
        .select('*')
        .eq('boq_id', boqId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data as unknown as BoqItem[]) || [];
    },
    enabled: !!boqId,
  });
}

export function useUpdateBoq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Boq> & { id: string }) => {
      const { data, error } = await supabase
        .from('boqs' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Boq;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['boqs'] });
      qc.invalidateQueries({ queryKey: ['boq', data.id] });
      qc.invalidateQueries({ queryKey: ['boq', 'by-lead', data.lead_id] });
      toast.success('BOQ updated');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update BOQ'),
  });
}

export function useCreateBoqForLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase
        .from('boqs' as any)
        .insert({ lead_id: leadId, status: 'draft' })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Boq;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boqs'] });
      qc.invalidateQueries({ queryKey: ['boq', 'by-lead'] });
      toast.success('BOQ created');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create BOQ'),
  });
}

export function useUpsertBoqItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<BoqItem> & { boq_id: string; description: string }) => {
      const { data, error } = await supabase
        .from('boq_items' as any)
        .upsert(item)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as BoqItem;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['boq-items', data.boq_id] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save item'),
  });
}

export function useDeleteBoqItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, boqId }: { id: string; boqId: string }) => {
      const { error } = await supabase.from('boq_items' as any).delete().eq('id', id);
      if (error) throw error;
      return { id, boqId };
    },
    onSuccess: ({ boqId }) => {
      qc.invalidateQueries({ queryKey: ['boq-items', boqId] });
      toast.success('Item removed');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete item'),
  });
}

export function useHandoffBoq() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (boqId: string) => {
      const { data, error } = await supabase
        .from('boqs' as any)
        .update({
          status: 'handed_off',
          handoff_to_sales_at: new Date().toISOString(),
          handoff_by: user?.id,
        })
        .eq('id', boqId)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Boq;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['boqs'] });
      qc.invalidateQueries({ queryKey: ['boq', data.id] });
      qc.invalidateQueries({ queryKey: ['boq', 'by-lead', data.lead_id] });
      toast.success('Handed off to Sales');
    },
    onError: (e: any) => toast.error(e?.message || 'Handoff failed'),
  });
}

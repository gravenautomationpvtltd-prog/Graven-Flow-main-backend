import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

/**
 * Subscribes the procurement queue to realtime INSERTs / UPDATEs on price_requests
 * so newly auto-created requests appear instantly. Returns connection state
 * and notifies on new arrivals assigned to the current user.
 */
export function useProcurementQueueRealtime() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [isLive, setIsLive] = useState(false);

  const invalidateNewQueue = () => {
    qc.invalidateQueries({ queryKey: ['price-request-queue'] });
    qc.invalidateQueries({ queryKey: ['price-request-kpis'] });
    qc.invalidateQueries({ queryKey: ['procurement-queue'] });
    qc.invalidateQueries({ queryKey: ['price-requests-pending-count'] });
    qc.invalidateQueries({ queryKey: ['spt-inbox'] });
  };

  useEffect(() => {
    const channel = supabase
      .channel('procurement-price-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'price_requests' },
        (payload: any) => {
          invalidateNewQueue();
          if (user?.id && payload?.new?.assigned_to === user.id) {
            toast.success('New price request assigned to you', {
              description: 'A fresh item just arrived in your queue.',
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'price_requests' },
        () => {
          invalidateNewQueue();
        },
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });
    return () => {
      supabase.removeChannel(channel);
      setIsLive(false);
    };
  }, [qc, user?.id]);

  return { isLive };
}

export type ProcurementTab = 'mine' | 'overdue' | 'completed';

export interface ProcurementQueueRow {
  id: string;
  lead_id: string;
  enquiry_item_id: string | null;
  status: 'pending' | 'in_progress' | 'resolved' | 'no_price';
  priority: string;
  created_at: string;
  tat_deadline: string | null;
  tat_status: 'on_track' | 'reminder_sent' | 'escalated' | 'critical' | null;
  resolved_at: string | null;
  hours_left: number | null; // negative if overdue
  customer_name: string | null;
  product_text: string;
  quantity: number | null;
  brand: string | null;
  target_rate: number | null;
  assignee_name: string | null;
  routed_via: 'brand_owner' | 'round_robin' | null;
  notes: string | null;
}

const SELECT = `
  id, lead_id, enquiry_item_id, status, priority, created_at, tat_deadline, tat_status,
  resolved_at, target_rate, assigned_to,
  lead:leads ( id, customer:customers(company_name) ),
  enquiry_item:enquiry_items (
    id, product_query_text, quantity, brand, routed_via, notes,
    matched_product:products(name, brand, hsn_code)
  ),
  assignee:profiles!price_requests_assigned_to_fkey ( id, full_name )
`;

function toRow(r: any): ProcurementQueueRow {
  const ei = Array.isArray(r.enquiry_item) ? r.enquiry_item[0] : r.enquiry_item;
  const lead = Array.isArray(r.lead) ? r.lead[0] : r.lead;
  const customer = lead?.customer ? (Array.isArray(lead.customer) ? lead.customer[0] : lead.customer) : null;
  const prod = ei?.matched_product
    ? (Array.isArray(ei.matched_product) ? ei.matched_product[0] : ei.matched_product)
    : null;
  const assignee = Array.isArray(r.assignee) ? r.assignee[0] : r.assignee;

  const hoursLeft = r.tat_deadline
    ? (new Date(r.tat_deadline).getTime() - Date.now()) / (1000 * 60 * 60)
    : null;

  return {
    id: r.id,
    lead_id: r.lead_id,
    enquiry_item_id: r.enquiry_item_id,
    status: r.status,
    priority: r.priority,
    created_at: r.created_at,
    tat_deadline: r.tat_deadline,
    tat_status: r.tat_status,
    resolved_at: r.resolved_at,
    hours_left: hoursLeft,
    customer_name: customer?.company_name || null,
    product_text:
      ei?.product_query_text ||
      prod?.name ||
      ei?.notes ||
      'Item pending description',
    quantity: ei?.quantity ?? null,
    brand: ei?.brand || prod?.brand || null,
    target_rate: r.target_rate ?? null,
    assignee_name: assignee?.full_name ?? null,
    routed_via: ei?.routed_via ?? null,
    notes: ei?.notes ?? null,
  };
}

export function useProcurementQueue(tab: ProcurementTab) {
  const { user, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['procurement-queue', tab, user?.id, isAdmin],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<ProcurementQueueRow[]> => {
      if (!user?.id) return [];

      let query = supabase.from('price_requests').select(SELECT).limit(500);

      if (tab === 'mine') {
        query = query.in('status', ['pending', 'in_progress']);
        if (!isAdmin) query = query.eq('assigned_to', user.id);
        query = query.order('tat_deadline', { ascending: true });
      } else if (tab === 'overdue') {
        query = query
          .in('status', ['pending', 'in_progress'])
          .lt('tat_deadline', new Date().toISOString())
          .order('tat_deadline', { ascending: true });
      } else {
        const since = new Date();
        since.setHours(0, 0, 0, 0);
        query = query
          .eq('status', 'resolved')
          .gte('resolved_at', since.toISOString());
        if (!isAdmin) query = query.eq('resolved_by', user.id);
        query = query.order('resolved_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(toRow);
    },
  });
}

export function tatChip(hours: number | null): { label: string; className: string } {
  if (hours === null) return { label: '—', className: 'bg-muted text-muted-foreground' };
  if (hours < 0) {
    const overdueH = Math.abs(hours);
    return {
      label: `Overdue ${overdueH < 1 ? `${Math.round(overdueH * 60)}m` : `${overdueH.toFixed(1)}h`}`,
      className: 'bg-destructive/15 text-destructive border-destructive/30',
    };
  }
  if (hours < 1) {
    return {
      label: `${Math.round(hours * 60)}m left`,
      className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    };
  }
  return {
    label: `${hours.toFixed(1)}h left`,
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  };
}

export function ageChip(createdAt: string): { label: string; className: string } | null {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  if (ageDays < 1) {
    return { label: 'New', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
  }
  if (ageDays < 3) return null;
  if (ageDays < 7) {
    return { label: `${Math.floor(ageDays)}d aging`, className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' };
  }
  return { label: `${Math.floor(ageDays)}d stale`, className: 'bg-destructive/15 text-destructive border-destructive/30' };
}
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['price-request-queue'] });
  qc.invalidateQueries({ queryKey: ['price-request-kpis'] });
  qc.invalidateQueries({ queryKey: ['procurement-queue'] });
  qc.invalidateQueries({ queryKey: ['price-requests'] });
  qc.invalidateQueries({ queryKey: ['price-requests-pending-count'] });
  qc.invalidateQueries({ queryKey: ['spt-inbox'] });
}

export function useDeletePriceRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('price_requests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Price request deleted');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete'),
  });
}

export function useBulkDeletePriceRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase.from('price_requests').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      invalidateAll(qc);
      toast.success(`Deleted ${ids.length} price request${ids.length === 1 ? '' : 's'}`);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete'),
  });
}

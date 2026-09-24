import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PriceRequestStatus = 'pending' | 'in_progress' | 'resolved' | 'no_price';
export type PriceRequestPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface PriceRequest {
  id: string;
  lead_id: string;
  enquiry_item_id: string | null;
  requested_by: string;
  requested_at: string;
  status: PriceRequestStatus;
  priority: PriceRequestPriority;
  assigned_to: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  supplier_id: string | null;
  resolved_price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Target rate from quotation items (customer's expected price)
  target_rate?: number | null;
  quoted_rate?: number | null;
  lead?: {
    id: string;
    title: string;
    estimated_value: number | null;
    customer?: {
      company_name: string;
    } | null;
  } | null;
  enquiry_item?: {
    id: string;
    product_query_text: string;
    quantity: number | null;
  } | null;
  requested_by_profile?: {
    id: string;
    full_name: string;
  } | null;
  assigned_to_profile?: {
    id: string;
    full_name: string;
  } | null;
  supplier?: {
    id: string;
    name: string;
  } | null;
}

export interface PriceRequestInsert {
  lead_id: string;
  enquiry_item_id?: string | null;
  requested_by: string;
  priority?: PriceRequestPriority;
  notes?: string;
  target_rate?: number | null;
}

export function usePriceRequests(filters?: { 
  status?: PriceRequestStatus; 
  assignedTo?: string;
  leadId?: string;
}) {
  return useQuery({
    staleTime: 60_000, // 1 minute
    queryKey: ['price-requests', filters],
    queryFn: async () => {
      let query = supabase
        .from('price_requests')
        .select(`
          *,
          lead:leads(id, title, estimated_value, customer:customers(company_name)),
          enquiry_item:enquiry_items(id, product_query_text, quantity, target_rate),
          requested_by_profile:profiles!price_requests_requested_by_fkey(id, full_name),
          assigned_to_profile:profiles!price_requests_assigned_to_fkey(id, full_name),
          supplier:suppliers(id, name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }
      if (filters?.leadId) {
        query = query.eq('lead_id', filters.leadId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Enrich with target rate - prioritize price_request.target_rate, then enquiry_item.target_rate
      const enrichedData = (data || []).map(request => {
        // Use target_rate from price_requests if set, otherwise from enquiry_item
        const target = request.target_rate ?? (request.enquiry_item as any)?.target_rate ?? null;
        return {
          ...request,
          target_rate: target,
        };
      });
      
      return enrichedData as PriceRequest[];
    },
  });
}

export function usePendingPriceRequestsCount() {
  return useQuery({
    queryKey: ['price-requests-pending-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('price_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useCreatePriceRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: PriceRequestInsert) => {
      // Also update enquiry_item.target_rate if provided
      if (request.enquiry_item_id && request.target_rate) {
        await supabase
          .from('enquiry_items')
          .update({ target_rate: request.target_rate })
          .eq('id', request.enquiry_item_id);
      }

      const { data, error } = await supabase
        .from('price_requests')
        .insert({
          ...request,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-requests'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-queue'] });
      queryClient.invalidateQueries({ queryKey: ['spt-inbox'] });
      if (variables.enquiry_item_id) {
        queryClient.invalidateQueries({ queryKey: ['enquiry-items'] });
      }
      toast.success('Price request sent to procurement');
    },
    onError: (error: Error) => {
      toast.error('Failed to create price request: ' + error.message);
    },
  });
}

export function useUpdatePriceRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<{
      status: PriceRequestStatus;
      assigned_to: string | null;
      resolved_by: string | null;
      resolved_at: string | null;
      resolved_price: number | null;
      supplier_id: string | null;
      notes: string;
    }>) => {
      const { data, error } = await supabase
        .from('price_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-requests'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-queue'] });
      queryClient.invalidateQueries({ queryKey: ['spt-inbox'] });
      toast.success('Price request updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update price request: ' + error.message);
    },
  });
}

export function useResolvePriceRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      userId, 
      price, 
      supplierId 
    }: { 
      id: string; 
      userId: string; 
      price?: number;
      supplierId?: string;
    }) => {
      const { data, error } = await supabase
        .from('price_requests')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
          resolved_price: price || null,
          supplier_id: supplierId || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-requests'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-queue'] });
      queryClient.invalidateQueries({ queryKey: ['spt-inbox'] });
      toast.success('Price request resolved');
    },
    onError: (error: Error) => {
      toast.error('Failed to resolve price request: ' + error.message);
    },
  });
}

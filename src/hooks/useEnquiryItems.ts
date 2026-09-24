import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EnquiryItem {
  id: string;
  lead_id: string;
  product_query_text: string;
  quantity: number | null;
  matched_product_id: string | null;
  price_available: boolean | null;
  price_flagged_to_procurement_at: string | null;
  price_flagged_by: string | null;
  price_resolved_at: string | null;
  price_resolved_by: string | null;
  supplier_id: string | null;
  target_rate: number | null;
  notes: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  procurement_price: number | null; // Price resolved by procurement
  price_valid_until: string | null; // How long the procurement price stays valid
  matched_product?: {
    id: string;
    name: string;
    description?: string | null;
    model_number?: string | null;
    default_rate: number | null;
    hsn_code?: string | null;
    unit?: string | null;
    tax_rate?: number | null;
  } | null;
  supplier?: {
    id: string;
    name: string;
  } | null;
}

export interface EnquiryItemInsert {
  lead_id: string;
  product_query_text: string;
  quantity?: number;
  matched_product_id?: string | null;
  price_available?: boolean;
  notes?: string;
  sort_order?: number;
  brand?: string | null;
}

export function useEnquiryItems(leadId: string | undefined) {
  return useQuery({
    queryKey: ['enquiry-items', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('enquiry_items')
        .select(`
          *,
          procurement_price,
          price_valid_until,
          matched_product:products(id, name, description, model_number, default_rate, hsn_code, unit, tax_rate),
          supplier:suppliers(id, name)
        `)
        .eq('lead_id', leadId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as EnquiryItem[];
    },
    enabled: !!leadId,
  });
}

export function useCreateEnquiryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: EnquiryItemInsert) => {
      const { data, error } = await supabase
        .from('enquiry_items')
        .insert(item)
        .select()
        .single();

      if (error) throw error;

      // Determine enquiry_status based on price availability
      const newEnquiryStatus = item.price_available ? 'ready_to_quote' : 'pending_prices';

      // Auto-update lead's has_enquiry and enquiry_status
      await supabase
        .from('leads')
        .update({ 
          has_enquiry: true,
          enquiry_status: newEnquiryStatus
        })
        .eq('id', item.lead_id);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-items', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['lead', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to add enquiry item: ' + error.message);
    },
  });
}

export function useUpdateEnquiryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId, ...updates }: { id: string; leadId: string } & Partial<EnquiryItemInsert>) => {
      const { data, error } = await supabase
        .from('enquiry_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, leadId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-items', data.leadId] });
      toast.success('Enquiry item updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update enquiry item: ' + error.message);
    },
  });
}

export function useDeleteEnquiryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await supabase
        .from('enquiry_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Check if any items remain - if not, reset has_enquiry
      const { count } = await supabase
        .from('enquiry_items')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', leadId);

      if (count === 0) {
        await supabase
          .from('leads')
          .update({ 
            has_enquiry: false, 
            enquiry_status: 'no_enquiry' 
          })
          .eq('id', leadId);
      }

      return { leadId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-items', data.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead', data.leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Enquiry item deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete enquiry item: ' + error.message);
    },
  });
}

export function useFlagToProcurement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId, userId }: { id: string; leadId: string; userId: string }) => {
      const { data, error } = await supabase
        .from('enquiry_items')
        .update({
          price_flagged_to_procurement_at: new Date().toISOString(),
          price_flagged_by: userId,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, leadId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-items', data.leadId] });
      toast.success('Flagged to procurement for pricing');
    },
    onError: (error: Error) => {
      toast.error('Failed to flag to procurement: ' + error.message);
    },
  });
}

export function useResolvePricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      leadId, 
      userId, 
      supplierId,
      matchedProductId 
    }: { 
      id: string; 
      leadId: string; 
      userId: string;
      supplierId?: string;
      matchedProductId?: string;
    }) => {
      const { data, error } = await supabase
        .from('enquiry_items')
        .update({
          price_available: true,
          price_resolved_at: new Date().toISOString(),
          price_resolved_by: userId,
          supplier_id: supplierId || null,
          matched_product_id: matchedProductId || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, leadId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-items', data.leadId] });
      toast.success('Price resolved');
    },
    onError: (error: Error) => {
      toast.error('Failed to resolve price: ' + error.message);
    },
  });
}

export function useLinkEnquiryToProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      leadId, 
      matchedProductId,
      priceAvailable,
    }: { 
      id: string; 
      leadId: string; 
      matchedProductId: string;
      priceAvailable: boolean;
    }) => {
      const { data, error } = await supabase
        .from('enquiry_items')
        .update({
          matched_product_id: matchedProductId,
          price_available: priceAvailable,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, leadId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-items', data.leadId] });
      toast.success('Item linked to catalog product');
    },
    onError: (error: Error) => {
      toast.error('Failed to link product: ' + error.message);
    },
  });
}

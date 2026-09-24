import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { QuotationItem, QuotationWithDetails } from './useQuotations';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';

// Helper function to validate UUIDs
function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Validate product IDs exist in database
async function validateProductIds(items: QuotationItem[]): Promise<QuotationItem[]> {
  const productIds = items
    .map(item => item.product_id)
    .filter((id): id is string => !!id && isValidUUID(id));
  
  if (productIds.length === 0) return items;

  const { data: existingProducts, error } = await supabase
    .from('products')
    .select('id')
    .in('id', productIds);

  if (error) {
    console.error('Failed to validate product IDs:', error);
    return items.map(item => ({ ...item, product_id: null }));
  }

  const validIds = new Set(existingProducts?.map(p => p.id) || []);

  return items.map(item => ({
    ...item,
    product_id: item.product_id && validIds.has(item.product_id) ? item.product_id : null
  }));
}

export interface DraftQuotationData {
  subject: string;
  notes: string;
  termsConditions: string;
  validUntil: string;
  currency: string;
  exchangeRate: number;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  advancePercent?: number | null;
  advanceAmount?: number | null;
  balanceAmount?: number | null;
  paymentRemark?: string | null;
  advanceRemark?: string | null;
  balanceRemark?: string | null;

  items: QuotationItem[];

}

// Hook to get any existing draft quotation for a lead
export function useLeadDraftQuotation(leadId: string | undefined) {
  return useQuery({
    queryKey: ['draft-quotation', leadId],
    queryFn: async () => {
      if (!leadId) return null;

      const { data: quotation, error: quotationError } = await supabase
        .from('quotations')
        .select(`
          *,
          customer:customers(id, company_name, contact_person, phone, email, address, city, state, pincode, gst_number),
          lead:leads(id, title),
          created_by_profile:profiles!quotations_created_by_fkey(id, full_name, email, phone)
        `)
        .eq('lead_id', leadId)
        .eq('status', 'draft')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (quotationError) throw quotationError;
      if (!quotation) return null;

      // Fetch items for the draft
      const { data: items, error: itemsError } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quotation.id)
        .order('sort_order');

      if (itemsError) throw itemsError;

      return { ...quotation, items } as QuotationWithDetails;
    },
    enabled: !!leadId,
  });
}

// Create a new draft quotation (minimal record, no activity log)
export function useCreateDraftQuotation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      leadId,
      customerId,
      data,
    }: {
      leadId?: string;
      customerId?: string;
      data: DraftQuotationData;
    }) => {
      // Validate product IDs before inserting
      const validatedItems = await validateProductIds(data.items);

      // Ensure fresh session before insert to prevent RLS failures during token refresh
      await ensureFreshSession();
      const tenantId = await requireTenantId();
      const { data: newQuotation, error: quotationError } = await supabase
        .from('quotations')
        .insert({
          quotation_number: `QT-TEMP-${Date.now()}`, // Will be replaced by trigger
          lead_id: leadId || null,
          customer_id: customerId || null,
          created_by: user?.id || null,
          subject: data.subject || null,
          notes: data.notes || null,
          terms_conditions: data.termsConditions || null,
          subtotal: data.subtotal,
          total_discount: data.totalDiscount,
          total_tax: data.totalTax,
          grand_total: data.grandTotal,
          advance_percent: data.advancePercent ?? null,
          advance_amount: data.advanceAmount ?? null,
          balance_amount: data.balanceAmount ?? null,
          payment_remark: data.paymentRemark ?? null,
          advance_remark: data.advanceRemark ?? null,
          balance_remark: data.balanceRemark ?? null,

          valid_until: data.validUntil || null,
          status: 'draft', // Explicitly draft
          currency: data.currency || 'INR',
          exchange_rate: data.exchangeRate || 1,
          tenant_id: tenantId,
        } as any)
        .select()
        .single();

      if (quotationError) throw quotationError;

      // Create items with validated product IDs
      if (validatedItems.length > 0) {
        const itemsToInsert = validatedItems.map((item, index) => ({
          quotation_id: newQuotation.id,
          product_id: item.product_id || null,
          enquiry_item_id: item.enquiry_item_id || null,
          description: item.description,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          target_rate: item.target_rate || null,
          discount_percent: item.discount_percent,
          discount_amount: item.discount_amount,
          tax_percent: item.tax_percent,
          tax_amount: item.tax_amount,
          amount: item.amount,
          sort_order: index,
          lead_time_days: item.lead_time_days || null,
        }));

        const { error: itemsError } = await supabase
          .from('quotation_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return newQuotation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations', data.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['draft-quotation', data.lead_id] });
      // No toast - this is auto-save, should be silent
    },
    onError: (error: Error) => {
      console.error('Failed to create draft quotation:', error);
      // Silent fail for auto-save
    },
  });
}

// Update an existing draft quotation
export function useUpdateDraftQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      leadId,
      data,
    }: {
      id: string;
      leadId?: string;
      data: DraftQuotationData;
    }) => {
      // Check current status before updating - don't update if no longer a draft
      const { data: currentQuotation } = await supabase
        .from('quotations')
        .select('status')
        .eq('id', id)
        .single();

      // Don't update if quotation is no longer a draft
      if (currentQuotation?.status && currentQuotation.status !== 'draft') {
        console.log('[Draft Update] Skipping - quotation is no longer a draft:', currentQuotation.status);
        return { id, leadId };
      }

      // Validate product IDs before updating
      const validatedItems = await validateProductIds(data.items);

      // Update quotation - only if still a draft
      const { error: quotationError } = await supabase
        .from('quotations')
        .update({
          subject: data.subject || null,
          notes: data.notes || null,
          terms_conditions: data.termsConditions || null,
          subtotal: data.subtotal,
          total_discount: data.totalDiscount,
          total_tax: data.totalTax,
          grand_total: data.grandTotal,
          advance_percent: data.advancePercent ?? null,
          advance_amount: data.advanceAmount ?? null,
          balance_amount: data.balanceAmount ?? null,
          payment_remark: data.paymentRemark ?? null,
          advance_remark: data.advanceRemark ?? null,
          balance_remark: data.balanceRemark ?? null,

          valid_until: data.validUntil || null,
          currency: data.currency || 'INR',
          exchange_rate: data.exchangeRate || 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'draft'); // Only update if still a draft

      if (quotationError) throw quotationError;

      // Delete existing items and re-insert
      const { error: deleteError } = await supabase
        .from('quotation_items')
        .delete()
        .eq('quotation_id', id);

      if (deleteError) throw deleteError;

      // Insert new items
      if (validatedItems.length > 0) {
        const itemsToInsert = validatedItems.map((item, index) => ({
          quotation_id: id,
          product_id: item.product_id || null,
          enquiry_item_id: item.enquiry_item_id || null,
          description: item.description,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          target_rate: item.target_rate || null,
          discount_percent: item.discount_percent,
          discount_amount: item.discount_amount,
          tax_percent: item.tax_percent,
          tax_amount: item.tax_amount,
          amount: item.amount,
          sort_order: index,
          lead_time_days: item.lead_time_days || null,
        }));

        const { error: itemsError } = await supabase
          .from('quotation_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return { id, leadId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations', data.leadId] });
      queryClient.invalidateQueries({ queryKey: ['draft-quotation', data.leadId] });
      queryClient.invalidateQueries({ queryKey: ['quotation', data.id] });
      // No toast - this is auto-save, should be silent
    },
    onError: (error: Error) => {
      console.error('Failed to update draft quotation:', error);
      // Silent fail for auto-save
    },
  });
}

// Delete a draft quotation
export function useDeleteDraftQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId?: string }) => {
      // Delete items first
      const { error: itemsError } = await supabase
        .from('quotation_items')
        .delete()
        .eq('quotation_id', id);

      if (itemsError) throw itemsError;

      // Then delete the quotation
      const { error: quotationError } = await supabase
        .from('quotations')
        .delete()
        .eq('id', id)
        .eq('status', 'draft'); // Only delete if still a draft

      if (quotationError) throw quotationError;

      return { leadId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotations', data.leadId] });
      queryClient.invalidateQueries({ queryKey: ['draft-quotation', data.leadId] });
    },
    onError: (error: Error) => {
      console.error('Failed to delete draft quotation:', error);
    },
  });
}

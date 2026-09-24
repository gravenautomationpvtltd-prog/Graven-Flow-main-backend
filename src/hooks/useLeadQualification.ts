import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { RFQItemSpec } from '@/hooks/useRFQItems';
import type { BoqItemCategory } from '@/hooks/useBoqs';

export type QualificationType = 'simple' | 'technical' | 'invalid';
export type RoutingTarget = 'spt' | 'tst' | 'discard' | 'nurture';

export interface LeadQualification {
  id: string;
  lead_id: string;
  tenant_id: string | null;
  qualification_type: QualificationType;
  routed_to: RoutingTarget;
  qualified_by: string;
  qualified_at: string;
  decision_reason: string | null;
  application: string | null;
  estimated_quantity: number | null;
  estimated_timeline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualifyItemInput {
  product_id: string | null;
  product_query_text: string; // catalog name OR custom text
  hsn_code?: string | null;
  quantity: number;
  notes?: string;
  /** Make / Brand for procurement routing. */
  brand?: string | null;
  // Technical-only specs (used for TST route → boq_items.technical_specs)
  specifications?: RFQItemSpec;
  category?: BoqItemCategory;
  // Optional file attachments for this item (uploaded after insert)
  attachments?: File[];
}

export function useLeadQualification(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-qualification', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      // History-mode: multiple rows per lead are allowed; show the latest.
      const { data, error } = await supabase
        .from('lead_qualification' as any)
        .select('*')
        .eq('lead_id', leadId)
        .order('qualified_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return (data as unknown as LeadQualification) || null;
    },
    enabled: !!leadId,
  });
}

export interface QualifyLeadInput {
  lead_id: string;
  qualification_type: QualificationType;
  routed_to: RoutingTarget;
  decision_reason?: string;
  application?: string;
  estimated_quantity?: number;
  estimated_timeline?: string;
  notes?: string;
  items?: QualifyItemInput[];
}

export function useQualifyLead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: QualifyLeadInput) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { items, ...qualPayload } = input;

      // 1) Insert enquiry_items first (so the SPT-routing trigger sees them)
      let insertedEnquiryItems: Array<{ id: string; sort_order: number }> = [];
      if (items && items.length > 0 && (input.routed_to === 'spt' || input.routed_to === 'tst')) {
        // Clear any prior items LQT may have entered for this lead in a previous attempt
        await supabase.from('enquiry_items').delete().eq('lead_id', input.lead_id);

        const enquiryRows = items.map((it, idx) => ({
          lead_id: input.lead_id,
          product_query_text: it.product_query_text,
          quantity: it.quantity,
          matched_product_id: it.product_id,
          notes: it.notes || null,
          sort_order: idx + 1,
          brand: it.brand?.trim() || null,
        }));
        const { data: insertedRows, error: eiErr } = await supabase
          .from('enquiry_items')
          .insert(enquiryRows)
          .select('id, sort_order');
        if (eiErr) throw eiErr;
        insertedEnquiryItems = (insertedRows || []) as Array<{ id: string; sort_order: number }>;

        // Upload attachments per item (best-effort; failures don't block qualification)
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const files = it.attachments || [];
          if (files.length === 0) continue;
          const matched = insertedEnquiryItems.find((r) => r.sort_order === i + 1);
          if (!matched) continue;
          for (const file of files) {
            try {
              const ts = Date.now();
              const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
              const filePath = `${input.lead_id}/${matched.id}/${ts}-${safeName}`;
              const { error: upErr } = await supabase.storage
                .from('enquiry-attachments')
                .upload(filePath, file);
              if (upErr) throw upErr;
              const { data: { publicUrl } } = supabase.storage
                .from('enquiry-attachments')
                .getPublicUrl(filePath);
              await supabase.from('enquiry_item_attachments').insert({
                enquiry_item_id: matched.id,
                file_name: file.name,
                file_url: publicUrl,
                file_type: file.type || null,
                file_size: file.size,
                uploaded_by: user.id,
              });
            } catch (uploadErr) {
              console.error('Attachment upload failed for', file.name, uploadErr);
              toast.warning(`Failed to upload ${file.name}`);
            }
          }
        }

        // Mark lead as having an enquiry
        await supabase
          .from('leads')
          .update({ has_enquiry: true, enquiry_status: 'pending_prices' })
          .eq('id', input.lead_id);
      }

      // 2) For Technical route → create BOQ shell + boq_items with tech specs
      if (input.routed_to === 'tst' && items && items.length > 0) {
        // Reuse existing BOQ for this lead if any, otherwise create one
        const { data: existingBoq } = await supabase
          .from('boqs' as any)
          .select('id')
          .eq('lead_id', input.lead_id)
          .maybeSingle();

        let boqId = (existingBoq as any)?.id as string | undefined;
        if (!boqId) {
          const { data: newBoq, error: bErr } = await supabase
            .from('boqs' as any)
            .insert({ lead_id: input.lead_id, status: 'draft' })
            .select('id')
            .single();
          if (bErr) throw bErr;
          boqId = (newBoq as any).id;
        } else {
          // Wipe prior items so LQT re-submission stays clean
          await supabase.from('boq_items' as any).delete().eq('boq_id', boqId);
        }

        const boqRows = items.map((it, idx) => ({
          boq_id: boqId,
          category: it.category || 'other',
          description: it.product_query_text,
          model_number: it.specifications?.model_number || null,
          manufacturer: it.specifications?.brand || null,
          quantity: it.quantity,
          unit: 'pcs',
          product_id: it.product_id,
          technical_specs: (it.specifications || {}) as any,
          sort_order: idx,
        }));
        const { error: biErr } = await supabase.from('boq_items' as any).insert(boqRows);
        if (biErr) throw biErr;
      }

      // 3) Insert qualification row (history-mode). The BEFORE INSERT trigger
      //    auto-deactivates any prior active qualification for this lead so
      //    re-routing (e.g. Nurture → SPT) no longer hits a unique-constraint error.
      const { data, error } = await supabase
        .from('lead_qualification' as any)
        .insert({ ...qualPayload, qualified_by: user.id, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as LeadQualification;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['lead-qualification', vars.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['enquiry-items', vars.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['boq', 'by-lead', vars.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['enquiry-attachment-counts'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lqt-leads'] });
      // Refresh downstream queues so SPT and Procurement see the new work immediately
      queryClient.invalidateQueries({ queryKey: ['spt-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-queue'] });
      queryClient.invalidateQueries({ queryKey: ['price-requests'] });
      queryClient.invalidateQueries({ queryKey: ['price-requests-pending-count'] });
      toast.success('Lead qualified successfully');
    },
    onError: (err: any) => {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('uq_lead_qualification_active') || msg.includes('duplicate key value')) {
        toast.error('This lead already has an active qualification. Please refresh and try again.');
        return;
      }
      if (msg.includes('cannot route lead to spt without at least one enquiry item')) {
        toast.error('Add at least one enquiry item before routing this lead to Sales.');
        return;
      }
      if (msg.includes('statement timeout') || msg.includes('canceling statement')) {
        toast.error('The request took too long. Please try again.');
        return;
      }
      toast.error(err?.message || 'Failed to qualify lead');
    },
  });
}

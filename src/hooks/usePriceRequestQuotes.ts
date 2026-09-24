import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserTenantId } from '@/utils/tenantUtils';
import { syncPriceToCatalog } from '@/lib/catalog-price-sync';
import { getProcurementHeadId } from '@/lib/procurement-head';
import { logActivity } from '@/lib/activity-logger';

const sel = (s: string): string => s;

export interface PriceQuote {
  id: string;
  price_request_id: string;
  round: number;
  supplier_id: string | null;
  supplier_name: string | null;
  purchase_price: number;
  sale_price: number | null;
  currency: string;
  lead_time_days: number | null;
  moq: number | null;
  valid_until: string | null;
  notes: string | null;
  is_pushed: boolean;
  pushed_at: string | null;
  pushed_by?: string | null;
  created_by: string | null;
  created_at: string;
  created_by_name?: string | null;
  pushed_by_name?: string | null;
}

export interface PriceRound {
  id: string;
  price_request_id: string;
  round: number;
  target_price: number | null;
  requested_by: string | null;
  requested_at: string;
  responder_id: string | null;
  revised_price: number | null;
  responded_at: string | null;
  outcome: string;
  notes: string | null;
  sales_decision: string | null;
  sales_decision_notes: string | null;
  sales_decision_at: string | null;
  sales_decision_by: string | null;
}

export function usePriceQuotes(priceRequestId?: string) {
  return useQuery({
    queryKey: ['price-request-quotes', priceRequestId],
    enabled: !!priceRequestId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_request_quotes')
        .select(sel('*'))
        .eq('price_request_id', priceRequestId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as unknown as PriceQuote[];

      const ids = [
        ...new Set(
          rows.flatMap((r) => [r.created_by, r.pushed_by]).filter(Boolean) as string[]
        ),
      ];
      if (!ids.length) return rows;
      const { data: people } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      const nameMap = new Map((people || []).map((p: any) => [p.id, p.full_name]));
      return rows.map((r) => ({
        ...r,
        created_by_name: r.created_by ? nameMap.get(r.created_by) ?? null : null,
        pushed_by_name: r.pushed_by ? nameMap.get(r.pushed_by) ?? null : null,
      }));
    },
  });

}

export function usePriceRounds(priceRequestId?: string) {
  return useQuery({
    queryKey: ['price-request-rounds', priceRequestId],
    enabled: !!priceRequestId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_request_rounds')
        .select(sel('*'))
        .eq('price_request_id', priceRequestId!)
        .order('round', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PriceRound[];
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ['price-request-quotes', id] });
  qc.invalidateQueries({ queryKey: ['price-request-rounds', id] });
  qc.invalidateQueries({ queryKey: ['price-request-queue'] });
  qc.invalidateQueries({ queryKey: ['price-request-kpis'] });
  qc.invalidateQueries({ queryKey: ['target-match-scorecard'] });
  qc.invalidateQueries({ queryKey: ['procurement-scorecard'] });
  qc.invalidateQueries({ queryKey: ['enquiry-price-requests'] });
}


export function useAddPriceQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quote: {
      price_request_id: string;
      round?: number;
      supplier_id?: string | null;
      supplier_name?: string | null;
      purchase_price: number;
      sale_price?: number | null;
      currency?: string;
      lead_time_days?: number | null;
      moq?: number | null;
      valid_until?: string | null;
      notes?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = await getUserTenantId();
      const { data, error } = await supabase
        .from('price_request_quotes')
        .insert({
          ...quote,
          currency: quote.currency || 'INR',
          tenant_id: tenantId,
          created_by: user?.id ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      invalidate(qc, d?.price_request_id);
      toast.success('Quote saved');
    },
    onError: (e: Error) => toast.error('Failed to save quote: ' + e.message),
  });
}

export function useDeletePriceQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; priceRequestId: string }) => {
      const { error } = await supabase.from('price_request_quotes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      invalidate(qc, v.priceRequestId);
      toast.success('Quote removed');
    },
    onError: (e: Error) => toast.error('Failed to remove quote: ' + e.message),
  });
}

/**
 * Push a quote to sales: marks it as the active price, writes it back onto the
 * price request, the enquiry item, flags target match and notifies sales.
 */
export function usePushQuoteToSales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      quote,
      request,
    }: {
      quote: PriceQuote;
      request: {
        id: string;
        lead_id: string | null;
        enquiry_item_id: string | null;
        requested_by: string | null;
        target_rate: number | null;
        product_text: string;
      };
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const price = quote.sale_price ?? quote.purchase_price;

      // one active quote per request
      await supabase
        .from('price_request_quotes')
        .update({ is_pushed: false })
        .eq('price_request_id', request.id);

      const { error: qErr } = await supabase
        .from('price_request_quotes')
        .update({ is_pushed: true, pushed_at: now, pushed_by: user?.id ?? null })
        .eq('id', quote.id);
      if (qErr) throw qErr;

      const matched =
        request.target_rate != null && price <= Number(request.target_rate) ? now : null;

      const { error: prErr } = await supabase
        .from('price_requests')
        .update({
          status: 'resolved',
          resolved_at: now,
          resolved_by: user?.id ?? null,
          resolved_price: price,
          supplier_id: quote.supplier_id,
          last_priced_by: user?.id ?? null,
          price_valid_until: quote.valid_until || null,
          target_matched_at: matched,
        })
        .eq('id', request.id);
      if (prErr) throw prErr;

      if (request.enquiry_item_id) {
        await supabase
          .from('enquiry_items')
          .update({
            price_available: true,
            price_resolved_at: now,
            price_resolved_by: user?.id ?? null,
            supplier_id: quote.supplier_id,
            procurement_price: price,
            price_valid_until: quote.valid_until || null,
          } as any)
          .eq('id', request.enquiry_item_id);
      }

      await syncPriceToCatalog({
        enquiryItemId: request.enquiry_item_id,
        productText: request.product_text,
        price,
        supplierId: quote.supplier_id,
        leadTimeDays: (quote as any).lead_time_days ?? null,
        validUntil: quote.valid_until || null,
        referenceId: request.id,
      });

      if (request.requested_by) {
        await supabase.from('notifications').insert({
          user_id: request.requested_by,
          title: matched ? 'Target price matched' : 'Price available',
          message: `${request.product_text} — ₹${price.toLocaleString('en-IN')}${
            matched ? ' (meets your target)' : ''
          }`,
          type: 'price_resolved',
          link: request.lead_id ? `/leads/${request.lead_id}` : null,
        } as any);
      }

      await logActivity({
        action: 'update',
        entityType: 'supplier',
        entityId: quote.supplier_id || request.id,
        entityName: quote.supplier_name || 'Unlinked supplier',
        metadata: {
          event: 'quote_pushed_to_sales',
          price_request_id: request.id,
          quote_id: quote.id,
          price,
          target_matched: !!matched,
        },
      });

      return { matched: !!matched };
    },
    onSuccess: (r, v) => {
      invalidate(qc, v.request.id);
      qc.invalidateQueries({ queryKey: ['enquiry-items'] });
      qc.invalidateQueries({ queryKey: ['spt-inbox'] });
      toast.success(r.matched ? 'Price pushed — target matched' : 'Price pushed to sales');
    },
    onError: (e: Error) => toast.error('Failed to push price: ' + e.message),
  });
}

/** Sales asks for a revised price — routes back to whoever gave the last price. */
export function useRequestRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request,
      targetPrice,
      notes,
    }: {
      request: { id: string; current_round: number | null; last_priced_by: string | null };
      targetPrice: number;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = await getUserTenantId();
      const round = (request.current_round || 1) + 1;
      // Route back to whoever last priced it; if nobody has, it goes to the head.
      const responder = request.last_priced_by || (await getProcurementHeadId());

      const { error } = await supabase.from('price_request_rounds').insert({
        price_request_id: request.id,
        tenant_id: tenantId,
        round,
        target_price: targetPrice,
        requested_by: user?.id ?? null,
        responder_id: responder,
        outcome: 'open',
        notes: notes || null,
      } as any);
      if (error) throw error;

      const { error: prErr } = await supabase
        .from('price_requests')
        .update({
          current_round: round,
          status: 'in_progress',
          target_rate: targetPrice,
          target_matched_at: null,
          assigned_to: responder,
        })
        .eq('id', request.id);
      if (prErr) throw prErr;

      if (responder) {
        await supabase.from('notifications').insert({
          user_id: responder,
          title: 'Revised price requested',
          message: `Sales asked for a revised price (target ₹${targetPrice.toLocaleString('en-IN')})`,
          type: 'price_revision',
          link: '/procurement',
        } as any);
      }
      return round;
    },
    onSuccess: (_r, v) => {
      invalidate(qc, v.request.id);
      toast.success('Revision requested from procurement');
    },
    onError: (e: Error) => toast.error('Failed to request revision: ' + e.message),
  });
}

/** Procurement answers an open round with a revised price (or declines). */
export function useRespondToRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roundId,
      priceRequestId,
      revisedPrice,
      declined,
      notes,
    }: {
      roundId: string;
      priceRequestId: string;
      revisedPrice?: number;
      declined?: boolean;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('price_request_rounds')
        .update({
          responder_id: user?.id ?? null,
          revised_price: declined ? null : revisedPrice ?? null,
          responded_at: new Date().toISOString(),
          outcome: declined ? 'declined' : 'revised',
          notes: notes || null,
        })
        .eq('id', roundId);
      if (error) throw error;
      if (!declined) {
        await supabase
          .from('price_requests')
          .update({ last_priced_by: user?.id ?? null })
          .eq('id', priceRequestId);
      }
    },
    onSuccess: (_d, v) => {
      invalidate(qc, v.priceRequestId);
      toast.success('Response recorded');
    },
    onError: (e: Error) => toast.error('Failed to record response: ' + e.message),
  });
}

/** Record what sales did with a matched price (with optional notes). */
export function useSetSalesOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, outcome, notes }: { id: string; outcome: string; notes?: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('price_requests')
        .update({
          sales_outcome: outcome,
          sales_outcome_at: new Date().toISOString(),
          sales_outcome_by: user?.id ?? null,
          ...(notes !== undefined ? { sales_outcome_notes: notes || null } : {}),
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      invalidate(qc, v.id);
      toast.success('Status updated');
    },
    onError: (e: Error) => toast.error('Failed to update status: ' + e.message),
  });
}

/**
 * Sales records acceptance/rejection of the price offered in a negotiation round,
 * with notes. Rejecting keeps the loop open for another reprice ask.
 */
export function useSetRoundDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roundId,
      priceRequestId,
      decision,
      notes,
      responderId,
      productText,
    }: {
      roundId: string;
      priceRequestId: string;
      decision: 'accepted' | 'rejected';
      notes?: string | null;
      responderId?: string | null;
      productText?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('price_request_rounds')
        .update({
          sales_decision: decision,
          sales_decision_notes: notes || null,
          sales_decision_at: new Date().toISOString(),
          sales_decision_by: user?.id ?? null,
        } as any)
        .eq('id', roundId);
      if (error) throw error;

      if (decision === 'accepted') {
        await supabase
          .from('price_requests')
          .update({
            sales_outcome: 'quoted',
            sales_outcome_at: new Date().toISOString(),
            sales_outcome_by: user?.id ?? null,
            ...(notes ? { sales_outcome_notes: notes } : {}),
          } as any)
          .eq('id', priceRequestId);
      }

      if (responderId) {
        await supabase.from('notifications').insert({
          user_id: responderId,
          title: decision === 'accepted' ? 'Sales accepted your price' : 'Sales rejected your price',
          message: `${productText || 'Price request'}${notes ? ` — ${notes}` : ''}`,
          type: 'price_decision',
          link: '/procurement',
        } as any);
      }
    },
    onSuccess: (_d, v) => {
      invalidate(qc, v.priceRequestId);
      toast.success(v.decision === 'accepted' ? 'Price accepted' : 'Price rejected');
    },
    onError: (e: Error) => toast.error('Failed to record decision: ' + e.message),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserTenantId } from '@/utils/tenantUtils';
import { validityNote } from '@/components/shared/PriceValidityBadge';
import { syncPriceToCatalog } from '@/lib/catalog-price-sync';

const sel = (s: string): string => s;

export interface ResolveRow {
  id: string;
  enquiry_item_id: string | null;
  lead_id: string | null;
  requested_by: string | null;
  status: string;
  target_rate: number | null;
  resolved_price: number | null;
  current_round: number | null;
  product_text: string;
  brand: string | null;
  quantity: number | null;
}

/**
 * All still-open price requests belonging to the same enquiry (lead), so
 * procurement can price the whole sheet in one go: Sr No / Item / Qty / Price.
 */
export function useResolveBatch(request?: {
  id: string;
  lead_id: string | null;
} | null) {
  return useQuery({
    queryKey: ['price-resolve-batch', request?.id, request?.lead_id],
    enabled: !!request?.id,
    queryFn: async (): Promise<ResolveRow[]> => {
      const base = supabase
        .from('price_requests')
        .select(
          sel(
            'id, enquiry_item_id, lead_id, requested_by, status, target_rate, resolved_price, current_round, created_at'
          )
        );

      const { data, error } = request!.lead_id
        ? await base
            .eq('lead_id', request!.lead_id)
            .in('status', ['pending', 'in_progress'])
            .order('created_at', { ascending: true })
        : await base.eq('id', request!.id);
      if (error) throw error;

      let rows = (data || []) as any[];
      if (!rows.some((r) => r.id === request!.id)) {
        const { data: self } = await base.eq('id', request!.id);
        rows = [...((self as any[]) || []), ...rows];
      }

      const eiIds = [...new Set(rows.map((r) => r.enquiry_item_id).filter(Boolean))] as string[];
      const { data: items } = eiIds.length
        ? await supabase
            .from('enquiry_items')
            .select(sel('id, product_query_text, quantity, brand, target_rate'))
            .in('id', eiIds)
        : { data: [] as any[] };
      const itemMap = new Map((items || []).map((i: any) => [i.id, i]));

      return rows.map((r) => {
        const item: any = r.enquiry_item_id ? itemMap.get(r.enquiry_item_id) : null;
        return {
          id: r.id,
          enquiry_item_id: r.enquiry_item_id,
          lead_id: r.lead_id,
          requested_by: r.requested_by,
          status: r.status,
          target_rate: r.target_rate ?? item?.target_rate ?? null,
          resolved_price: r.resolved_price ?? null,
          current_round: r.current_round ?? 1,
          product_text: item?.product_query_text || 'Item pending description',
          brand: item?.brand ?? null,
          quantity: item?.quantity ?? null,
        };
      });
    },
  });
}

export interface ResolveAlternate {
  price: number;
  supplierName?: string | null;
  supplierId?: string | null;
  leadTimeDays?: number | null;
  validUntil?: string | null;
  notes?: string | null;
}

export interface ResolveEntry {
  request: ResolveRow;
  price: number;
  supplierName?: string | null;
  supplierId?: string | null;
  leadTimeDays?: number | null;
  validUntil?: string | null;
  notes?: string | null;
  /** Extra supplier prices captured for the same item (procurement-only). */
  alternates?: ResolveAlternate[];
}


/** Save + push a whole sheet of prices at once. */
export function useBulkResolvePrices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: ResolveEntry[]) => {
      if (!entries.length) return { count: 0, matched: 0 };
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = await getUserTenantId();
      const now = new Date().toISOString();
      let matched = 0;

      for (const e of entries) {
        const r = e.request;
        const buildQuote = (a: ResolveAlternate, pushed: boolean) => {
          const vNote = validityNote(a.validUntil);
          return {
            price_request_id: r.id,
            tenant_id: tenantId,
            round: r.current_round || 1,
            supplier_id: a.supplierId || null,
            supplier_name: a.supplierName || null,
            purchase_price: a.price,
            sale_price: a.price,
            currency: 'INR',
            lead_time_days: a.leadTimeDays ?? null,
            valid_until: a.validUntil || null,
            notes: [a.notes || null, vNote].filter(Boolean).join(' · ') || null,
            is_pushed: pushed,
            pushed_at: pushed ? now : null,
            pushed_by: pushed ? user?.id ?? null : null,
            created_by: user?.id ?? null,
          };
        };

        const quoteRows = [
          buildQuote(
            {
              price: e.price,
              supplierName: e.supplierName,
              supplierId: e.supplierId,
              leadTimeDays: e.leadTimeDays,
              validUntil: e.validUntil,
              notes: e.notes,
            },
            true
          ),
          ...(e.alternates || []).map((a) => buildQuote(a, false)),
        ];

        const { error: qErr } = await supabase
          .from('price_request_quotes')
          .insert(quoteRows as any);
        if (qErr) throw qErr;


        const isMatched = r.target_rate != null && e.price <= Number(r.target_rate);
        if (isMatched) matched += 1;

        const { error: prErr } = await supabase
          .from('price_requests')
          .update({
            status: 'resolved',
            resolved_at: now,
            resolved_by: user?.id ?? null,
            resolved_price: e.price,
            last_priced_by: user?.id ?? null,
            price_valid_until: e.validUntil || null,
            supplier_id: e.supplierId || null,
            target_matched_at: isMatched ? now : null,
          })
          .eq('id', r.id);
        if (prErr) throw prErr;

        if (r.enquiry_item_id) {
          await supabase
            .from('enquiry_items')
            .update({
              price_available: true,
              price_resolved_at: now,
              price_resolved_by: user?.id ?? null,
              procurement_price: e.price,
              price_valid_until: e.validUntil || null,
              supplier_id: e.supplierId || null,
            } as any)
            .eq('id', r.enquiry_item_id);
        }

        // Persist to the product catalog so the price is reusable forever.
        await syncPriceToCatalog({
          enquiryItemId: r.enquiry_item_id,
          productText: r.product_text,
          brand: r.brand,
          price: e.price,
          supplierId: e.supplierId || null,
          leadTimeDays: e.leadTimeDays ?? null,
          validUntil: e.validUntil || null,
          referenceId: r.id,
        });
      }

      // one notification per requester
      const byRequester = new Map<string, ResolveEntry[]>();
      for (const e of entries) {
        if (!e.request.requested_by) continue;
        const list = byRequester.get(e.request.requested_by) || [];
        list.push(e);
        byRequester.set(e.request.requested_by, list);
      }
      for (const [uid, list] of byRequester) {
        await supabase.from('notifications').insert({
          user_id: uid,
          title: `Prices available for ${list.length} item${list.length === 1 ? '' : 's'}`,
          message: list
            .slice(0, 3)
            .map((e) => `${e.request.product_text} — ₹${e.price.toLocaleString('en-IN')}`)
            .join(' · '),
          type: 'price_resolved',
          link: list[0].request.lead_id ? `/leads/${list[0].request.lead_id}` : null,
        } as any);
      }

      return { count: entries.length, matched };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['price-resolve-batch'] });
      qc.invalidateQueries({ queryKey: ['price-request-queue'] });
      qc.invalidateQueries({ queryKey: ['price-request-kpis'] });
      qc.invalidateQueries({ queryKey: ['procurement-queue'] });
      qc.invalidateQueries({ queryKey: ['enquiry-items'] });
      qc.invalidateQueries({ queryKey: ['spt-inbox'] });
      toast.success(
        `${r.count} price${r.count === 1 ? '' : 's'} sent to sales${
          r.matched ? ` · ${r.matched} met target` : ''
        }`
      );
    },
    onError: (e: Error) => toast.error('Failed to save prices: ' + e.message),
  });
}

/** Mark a single line as "no price available". */
export function useMarkNoPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('price_requests')
        .update({ status: 'no_price', resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['price-resolve-batch'] });
      qc.invalidateQueries({ queryKey: ['price-request-queue'] });
      qc.invalidateQueries({ queryKey: ['price-request-kpis'] });
      toast.success('Marked as no price');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

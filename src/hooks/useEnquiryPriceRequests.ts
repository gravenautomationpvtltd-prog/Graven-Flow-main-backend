import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EnquiryPriceRequest {
  id: string;
  enquiry_item_id: string | null;
  lead_id: string | null;
  status: string;
  current_round: number | null;
  last_priced_by: string | null;
  target_rate: number | null;
  resolved_price: number | null;
  target_matched_at: string | null;
  sales_outcome: string | null;
  sales_outcome_notes: string | null;
  price_valid_until: string | null;
  created_at: string;
}

/**
 * Latest price request per enquiry item, for the sales side of the negotiation loop.
 * Deliberately light: no joins, no supplier data (sales never sees supplier quotes).
 */
export function useEnquiryPriceRequests(leadId?: string) {
  return useQuery({
    queryKey: ['enquiry-price-requests', leadId],
    enabled: !!leadId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_requests')
        .select(
          'id, enquiry_item_id, lead_id, status, current_round, last_priced_by, target_rate, resolved_price, target_matched_at, sales_outcome, sales_outcome_notes, price_valid_until, created_at'
        )
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const map: Record<string, EnquiryPriceRequest> = {};
      for (const row of (data || []) as unknown as EnquiryPriceRequest[]) {
        if (!row.enquiry_item_id) continue;
        // rows are newest-first, so the first one wins
        if (!map[row.enquiry_item_id]) map[row.enquiry_item_id] = row;
      }
      return map;
    },
  });
}

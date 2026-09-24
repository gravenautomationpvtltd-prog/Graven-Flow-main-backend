import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QuotationVersionItem {
  id?: string;
  description: string;
  hsn_code?: string | null;
  quantity: number;
  rate: number;
  unit?: string | null;
  discount_percent?: number | null;
  tax_percent?: number | null;
  amount: number;
  tax_amount?: number | null;
  product_id?: string | null;
}

export interface QuotationVersion {
  id: string;
  quotation_id: string;
  version_number: number;
  created_at: string;
  created_by: string | null;
  subject: string | null;
  notes: string | null;
  terms_conditions: string | null;
  subtotal: number | null;
  total_discount: number | null;
  total_tax: number | null;
  grand_total: number | null;
  valid_until: string | null;
  currency: string | null;
  exchange_rate: number | null;
  items_snapshot: QuotationVersionItem[];
  change_reason: string | null;
  created_by_profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export function useQuotationVersions(quotationId: string | undefined) {
  return useQuery({
    queryKey: ['quotation-versions', quotationId],
    queryFn: async (): Promise<QuotationVersion[]> => {
      if (!quotationId) return [];

      const { data, error } = await supabase
        .from('quotation_versions')
        .select(`
          *,
          created_by_profile:profiles!quotation_versions_created_by_fkey(
            full_name,
            email
          )
        `)
        .eq('quotation_id', quotationId)
        .order('version_number', { ascending: false });

      if (error) throw error;

      // Parse items_snapshot from JSON
      return (data || []).map(version => ({
        ...version,
        items_snapshot: (Array.isArray(version.items_snapshot) ? version.items_snapshot : []) as unknown as QuotationVersionItem[]
      }));
    },
    enabled: !!quotationId
  });
}

export function useQuotationVersion(versionId: string | undefined) {
  return useQuery({
    queryKey: ['quotation-version', versionId],
    queryFn: async (): Promise<QuotationVersion | null> => {
      if (!versionId) return null;

      const { data, error } = await supabase
        .from('quotation_versions')
        .select(`
          *,
          created_by_profile:profiles!quotation_versions_created_by_fkey(
            full_name,
            email
          )
        `)
        .eq('id', versionId)
        .single();

      if (error) throw error;

      return {
        ...data,
        items_snapshot: (Array.isArray(data.items_snapshot) ? data.items_snapshot : []) as unknown as QuotationVersionItem[]
      };
    },
    enabled: !!versionId
  });
}

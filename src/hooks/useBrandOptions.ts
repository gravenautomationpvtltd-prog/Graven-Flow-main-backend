import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BrandOption {
  brand: string;
  hasOwner: boolean;
  ownerName?: string | null;
}

/**
 * Returns a deduplicated list of brands sourced from:
 *  - products.brand (catalog)
 *  - brand_owners.brand (configured)
 *  - recent enquiry_items.brand
 * Each option carries an `hasOwner` flag (and owner name) so the form can
 * show a routing preview chip.
 */
export function useBrandOptions() {
  return useQuery({
    queryKey: ['brand-options'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BrandOption[]> => {
      const [productsRes, ownersRes, recentRes] = await Promise.all([
        supabase.from('products').select('brand').not('brand', 'is', null).limit(2000),
        supabase
          .from('brand_owners' as any)
          .select('brand, owner_user_id, profiles:profiles!brand_owners_owner_user_id_fkey(full_name)'),
        supabase
          .from('enquiry_items')
          .select('brand')
          .not('brand', 'is', null)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      const ownerMap = new Map<string, string | null>();
      ((ownersRes.data as any[]) || []).forEach((row) => {
        if (!row?.brand) return;
        const key = String(row.brand).trim().toLowerCase();
        if (!key) return;
        const name = row.profiles?.full_name || null;
        if (!ownerMap.has(key)) ownerMap.set(key, name);
      });

      const labelMap = new Map<string, string>(); // lowercase -> original casing
      const addBrand = (raw: unknown) => {
        if (!raw) return;
        const trimmed = String(raw).trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (!labelMap.has(key)) labelMap.set(key, trimmed);
      };

      ((productsRes.data as any[]) || []).forEach((r) => addBrand(r.brand));
      ((ownersRes.data as any[]) || []).forEach((r) => addBrand(r.brand));
      ((recentRes.data as any[]) || []).forEach((r) => addBrand(r.brand));

      return Array.from(labelMap.entries())
        .map(([key, label]) => ({
          brand: label,
          hasOwner: ownerMap.has(key),
          ownerName: ownerMap.get(key) || null,
        }))
        .sort((a, b) => a.brand.localeCompare(b.brand));
    },
  });
}

/** Quick lookup helper used by the routing preview chip. */
export function useBrandOwnerLookup(brand: string | null | undefined) {
  const { data } = useBrandOptions();
  if (!brand?.trim()) return null;
  const key = brand.trim().toLowerCase();
  return data?.find((b) => b.brand.toLowerCase() === key) || null;
}

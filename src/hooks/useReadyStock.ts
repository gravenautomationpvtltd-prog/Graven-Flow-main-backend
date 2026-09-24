import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReadyStockEntry {
  qty: number;
  byOffice: { officeId: string; officeName: string; qty: number }[];
}

async function fetchStock(productIds: string[]) {
  const map = new Map<string, ReadyStockEntry>();
  if (productIds.length === 0) return map;

  // Chunked so a large product page never blows the URL length limit
  const chunkSize = 200;
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('inventory')
      .select('product_id, quantity, office_id, office:offices(id, name)')
      .in('product_id', chunk)
      .gt('quantity', 0);
    if (error) throw error;
    for (const row of (data || []) as any[]) {
      const qty = Number(row.quantity) || 0;
      if (qty <= 0) continue;
      const entry = map.get(row.product_id) || { qty: 0, byOffice: [] };
      entry.qty += qty;
      entry.byOffice.push({
        officeId: row.office_id,
        officeName: row.office?.name || 'Warehouse',
        qty,
      });
      map.set(row.product_id, entry);
    }
  }
  return map;
}

/** Ready-stock quantities (across all warehouses) for a set of products. */
export function useReadyStockMap(productIds: string[]) {
  const ids = [...new Set(productIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ['ready-stock', ids],
    queryFn: () => fetchStock(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

/** Ready-stock detail for a single product. */
export function useProductStock(productId: string | undefined) {
  return useQuery({
    queryKey: ['ready-stock', 'single', productId],
    queryFn: async () => {
      const map = await fetchStock([productId!]);
      return map.get(productId!) ?? { qty: 0, byOffice: [] };
    },
    enabled: !!productId,
    staleTime: 60_000,
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LedgerRow {
  id: string;
  created_at: string;
  movement_type: string;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  product_id: string;
  office_id: string;
  qtyIn: number;
  qtyOut: number;
  balance: number;
  product?: { id: string; name: string; model_number: string | null; unit: string | null } | null;
  office?: { id: string; name: string } | null;
  creator?: { id: string; full_name: string } | null;
}

export interface LedgerFilters {
  productId?: string;
  officeId?: string;
  from?: string;
  to?: string;
}

/** Positive = material came in, negative = material went out. */
export function signedQuantity(movementType: string, quantity: number) {
  const qty = Math.abs(Number(quantity) || 0);
  if (movementType === 'out' || movementType === 'writeoff') return -qty;
  if (movementType === 'hold') return 0; // held material never entered sellable stock
  return qty; // 'in' and 'adjustment'
}

export function movementLabel(row: { movement_type: string; reference_type: string | null }) {
  switch (row.reference_type) {
    case 'grn':
      return 'Received (QC passed)';
    case 'qc_hold':
      return 'Held at QC';
    case 'qc_release':
      return 'Released from hold';
    case 'qc_writeoff':
      return 'Written off';
    case 'dispatch':
      return 'Dispatched';
    default:
      break;
  }
  if (row.movement_type === 'in') return 'Stock in';
  if (row.movement_type === 'out') return 'Stock out';
  return 'Adjustment';
}

/**
 * Came, gone and remaining for a product/warehouse over a date range, with a
 * running balance carried forward from everything that happened before it.
 */
export function useStockLedger(filters: LedgerFilters) {
  const { productId, officeId, from, to } = filters;

  return useQuery({
    queryKey: ['stock-ledger', productId, officeId, from, to],
    queryFn: async () => {
      const base = () => {
        let q = supabase
          .from('stock_movements')
          .select(`
            id, created_at, movement_type, quantity, reference_type, reference_id, notes, product_id, office_id,
            product:products(id, name, model_number, unit),
            office:offices(id, name),
            creator:profiles!stock_movements_created_by_fkey(id, full_name)
          `);
        if (productId) q = q.eq('product_id', productId);
        if (officeId) q = q.eq('office_id', officeId);
        return q;
      };

      // Everything before the window gives us the opening balance
      let opening = 0;
      if (from) {
        const { data: prior, error: priorError } = await base()
          .lt('created_at', new Date(`${from}T00:00:00`).toISOString())
          .limit(20000);
        if (priorError) throw priorError;
        opening = (prior || []).reduce(
          (sum, m: any) => sum + signedQuantity(m.movement_type, m.quantity),
          0,
        );
      }

      let query = base().order('created_at', { ascending: true }).limit(5000);
      if (from) query = query.gte('created_at', new Date(`${from}T00:00:00`).toISOString());
      if (to) query = query.lte('created_at', new Date(`${to}T23:59:59`).toISOString());

      const { data, error } = await query;
      if (error) throw error;

      let balance = opening;
      const rows: LedgerRow[] = (data || []).map((m: any) => {
        const signed = signedQuantity(m.movement_type, m.quantity);
        balance += signed;
        return {
          ...m,
          qtyIn: signed > 0 ? signed : 0,
          qtyOut: signed < 0 ? -signed : 0,
          balance,
        } as LedgerRow;
      });

      const totalIn = rows.reduce((s, r) => s + r.qtyIn, 0);
      const totalOut = rows.reduce((s, r) => s + r.qtyOut, 0);

      return { rows, opening, totalIn, totalOut, closing: balance };
    },
  });
}

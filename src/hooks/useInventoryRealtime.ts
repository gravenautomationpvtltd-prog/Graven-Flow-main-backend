import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Keeps warehouse stock live everywhere: a receipt, adjustment or dispatch made
 * anywhere in the company refreshes stock badges, product pages and the
 * quotation picker without a reload.
 */
export function useInventoryRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['ready-stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    };

    const channel = supabase
      .channel('inventory-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

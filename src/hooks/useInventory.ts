import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InventoryItem {
  id: string;
  product_id: string;
  office_id: string;
  quantity: number;
  min_stock_level: number;
  max_stock_level: number | null;
  last_restocked_at: string | null;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    hsn_code: string | null;
    unit: string | null;
    default_rate: number | null;
  };
  office?: {
    id: string;
    name: string;
  };
}

export interface StockMovement {
  id: string;
  inventory_id: string | null;
  product_id: string;
  office_id: string;
  movement_type: string;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  product?: {
    id: string;
    name: string;
  };
  creator?: {
    id: string;
    full_name: string;
  };
}

export function useInventory(officeId?: string) {
  return useQuery({
    queryKey: ['inventory', officeId],
    queryFn: async () => {
      let query = supabase
        .from('inventory')
        .select(`
          *,
          product:products(id, name, hsn_code, unit, default_rate),
          office:offices(id, name)
        `)
        .order('created_at', { ascending: false });

      if (officeId) {
        query = query.eq('office_id', officeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InventoryItem[];
    },
  });
}

export function useLowStockItems() {
  return useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          product:products(id, name, hsn_code, unit, default_rate),
          office:offices(id, name)
        `);
      
      if (error) throw error;
      
      // Filter items where quantity <= min_stock_level
      return (data as InventoryItem[]).filter(item => item.quantity <= item.min_stock_level);
    },
  });
}

export function useStockMovements(productId?: string, officeId?: string) {
  return useQuery({
    queryKey: ['stock-movements', productId, officeId],
    queryFn: async () => {
      let query = supabase
        .from('stock_movements')
        .select(`
          *,
          product:products(id, name),
          creator:profiles!stock_movements_created_by_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (productId) {
        query = query.eq('product_id', productId);
      }
      if (officeId) {
        query = query.eq('office_id', officeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as StockMovement[];
    },
  });
}

export function useCreateOrUpdateInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      product_id: string;
      office_id: string;
      quantity: number;
      min_stock_level?: number;
      max_stock_level?: number | null;
    }) => {
      // Check if inventory exists
      const { data: existing } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', data.product_id)
        .eq('office_id', data.office_id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data: updated, error } = await supabase
          .from('inventory')
          .update({
            quantity: data.quantity,
            min_stock_level: data.min_stock_level ?? 0,
            max_stock_level: data.max_stock_level,
            last_restocked_at: data.quantity > existing.quantity ? new Date().toISOString() : undefined,
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return updated;
      } else {
        // Create new
        const { data: created, error } = await supabase
          .from('inventory')
          .insert({
            product_id: data.product_id,
            office_id: data.office_id,
            quantity: data.quantity,
            min_stock_level: data.min_stock_level ?? 0,
            max_stock_level: data.max_stock_level,
            last_restocked_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (error) throw error;
        return created;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Inventory updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update inventory: ' + error.message);
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      product_id: string;
      office_id: string;
      adjustment: number;
      movement_type: 'in' | 'out' | 'adjustment';
      notes?: string;
      reference_type?: string;
      reference_id?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // Get current inventory
      const { data: inventory } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('product_id', data.product_id)
        .eq('office_id', data.office_id)
        .maybeSingle();

      let inventoryId = inventory?.id;
      const currentQty = inventory?.quantity ?? 0;
      const newQty = data.movement_type === 'out' 
        ? currentQty - Math.abs(data.adjustment)
        : currentQty + Math.abs(data.adjustment);

      if (inventory) {
        // Update existing inventory
        const { error } = await supabase
          .from('inventory')
          .update({
            quantity: newQty,
            last_restocked_at: data.movement_type === 'in' ? new Date().toISOString() : undefined,
          })
          .eq('id', inventory.id);
        if (error) throw error;
      } else {
        // Create inventory record
        const { data: newInv, error } = await supabase
          .from('inventory')
          .insert({
            product_id: data.product_id,
            office_id: data.office_id,
            quantity: newQty,
            last_restocked_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (error) throw error;
        inventoryId = newInv.id;
      }

      // Create stock movement record
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          inventory_id: inventoryId,
          product_id: data.product_id,
          office_id: data.office_id,
          movement_type: data.movement_type,
          quantity: data.adjustment,
          notes: data.notes,
          reference_type: data.reference_type,
          reference_id: data.reference_id,
          created_by: userId,
        });

      if (movementError) throw movementError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast.success('Stock adjusted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to adjust stock: ' + error.message);
    },
  });
}

export function useDeleteInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inventoryId: string) => {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', inventoryId);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Inventory item deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete inventory: ' + error.message);
    },
  });
}

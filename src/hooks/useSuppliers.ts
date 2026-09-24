import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { logActivity } from '@/lib/activity-logger';

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst_number: string | null;
  payment_terms: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // New vendor registration fields
  pan_number: string | null;
  website: string | null;
  category: string | null;
  is_authorized_dealer: boolean | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  preferred_currency: string | null;
  status: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  gst_certificate_url: string | null;
  pan_card_url: string | null;
  cancelled_cheque_url: string | null;
  coi_url: string | null;
  msme_certificate_url: string | null;
  brand_authorization_url: string | null;
}

type SupplierInsert = Omit<Supplier, 'id' | 'created_at' | 'updated_at'>;
type SupplierUpdate = Partial<SupplierInsert> & { id: string };

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function useSuppliersByStatus(status?: string) {
  return useQuery({
    queryKey: ['suppliers', 'status', status],
    queryFn: async () => {
      let query = supabase.from('suppliers').select('*').order('created_at', { ascending: false });
      
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function useActiveSuppliers() {
  return useQuery({
    queryKey: ['suppliers', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .eq('status', 'approved')
        .order('name');
      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function usePendingVendors() {
  return useQuery({
    queryKey: ['suppliers', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (supplier: SupplierInsert) => {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({ ...supplier, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier created successfully');
      logActivity({
        action: 'create',
        entityType: 'supplier',
        entityId: data.id,
        entityName: data.name,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create supplier: ' + error.message);
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: SupplierUpdate) => {
      const { data, error } = await supabase
        .from('suppliers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier updated successfully');
      logActivity({
        action: 'update',
        entityType: 'supplier',
        entityId: data.id,
        entityName: data.name,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to update supplier: ' + error.message);
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier deleted successfully');
      logActivity({
        action: 'delete',
        entityType: 'supplier',
        entityId: id,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to delete supplier: ' + error.message);
    },
  });
}

export function useApproveVendor() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      // First update the vendor status
      const { data, error } = await supabase
        .from('suppliers')
        .update({
          status: 'approved',
          is_active: true,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Send email notification if vendor has email
      if (data.email) {
        try {
          await supabase.functions.invoke('send-vendor-status-email', {
            body: {
              vendorName: data.name,
              vendorEmail: data.email,
              contactPerson: data.contact_person,
              status: 'approved',
            },
          });
          console.log('Approval email sent to vendor:', data.email);
        } catch (emailError) {
          console.error('Failed to send approval email:', emailError);
          // Don't fail the mutation if email fails
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Vendor approved successfully. Email notification sent.');
    },
    onError: (error: Error) => {
      toast.error('Failed to approve vendor: ' + error.message);
    },
  });
}

export function useRejectVendor() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      // First update the vendor status
      const { data, error } = await supabase
        .from('suppliers')
        .update({
          status: 'rejected',
          is_active: false,
          rejection_reason: reason,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Send email notification if vendor has email
      if (data.email) {
        try {
          await supabase.functions.invoke('send-vendor-status-email', {
            body: {
              vendorName: data.name,
              vendorEmail: data.email,
              contactPerson: data.contact_person,
              status: 'rejected',
              rejectionReason: reason,
            },
          });
          console.log('Rejection email sent to vendor:', data.email);
        } catch (emailError) {
          console.error('Failed to send rejection email:', emailError);
          // Don't fail the mutation if email fails
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Vendor rejected. Email notification sent.');
    },
    onError: (error: Error) => {
      toast.error('Failed to reject vendor: ' + error.message);
    },
  });
}

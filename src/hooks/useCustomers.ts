import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { logActivity } from '@/lib/activity-logger';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession, isPermissionError } from '@/utils/sessionGuard';

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export interface CustomerFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  assignedSalesId?: string;
  segment?: string;
}

export interface CustomersResult {
  data: Customer[];
  totalCount: number;
}

export function useCustomers(filters?: CustomerFilters | string) {
  // Handle legacy string parameter for backward compatibility
  const normalizedFilters: CustomerFilters = typeof filters === 'string' 
    ? { search: filters } 
    : filters ?? {};

  return useQuery({
    queryKey: ['customers', normalizedFilters],
    queryFn: async (): Promise<CustomersResult> => {
      const page = normalizedFilters.page ?? 0;
      const pageSize = normalizedFilters.pageSize ?? 50;
      const from = page * pageSize;
      const to = from + pageSize - 1;

      // First get total count (exclude soft-deleted)
      let countQuery = supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      // Filter by assigned sales person if provided
      if (normalizedFilters.assignedSalesId) {
        countQuery = countQuery.eq('assigned_sales_id', normalizedFilters.assignedSalesId);
      }

      if (normalizedFilters.search) {
        countQuery = countQuery.or(
          `company_name.ilike.%${normalizedFilters.search}%,contact_person.ilike.%${normalizedFilters.search}%,phone.ilike.%${normalizedFilters.search}%`
        );
      }

      if (normalizedFilters.segment && normalizedFilters.segment !== 'all') {
        countQuery = countQuery.eq('segment', normalizedFilters.segment as any);
      }

      const { count } = await countQuery;

      // Build data query (exclude soft-deleted, show newest first)
      let query = supabase
        .from('customers')
        .select('*, assigned_sales:profiles!assigned_sales_id(full_name)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Filter by assigned sales person if provided
      if (normalizedFilters.assignedSalesId) {
        query = query.eq('assigned_sales_id', normalizedFilters.assignedSalesId);
      }

      if (normalizedFilters.search) {
        query = query.or(
          `company_name.ilike.%${normalizedFilters.search}%,contact_person.ilike.%${normalizedFilters.search}%,phone.ilike.%${normalizedFilters.search}%`
        );
      }

      if (normalizedFilters.segment && normalizedFilters.segment !== 'all') {
        query = query.eq('segment', normalizedFilters.segment as any);
      }

      // Apply pagination
      query = query.range(from, to);

      const { data, error } = await query;
      if (error) throw error;
      
      return {
        data: data as Customer[],
        totalCount: count ?? 0,
      };
    },
  });
}

// Infinite query hook for unlimited customer loading with pagination
export interface InfiniteCustomerFilters {
  search?: string;
  pageSize?: number;
  assignedSalesId?: string;
}

export function useInfiniteCustomers(filters?: InfiniteCustomerFilters) {
  const normalizedFilters = filters ?? {};
  const pageSize = normalizedFilters.pageSize ?? 50;

  return useInfiniteQuery({
    queryKey: ['customers-infinite', normalizedFilters],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      // Get total count for the first page (exclude soft-deleted)
      let countQuery = supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      if (normalizedFilters.assignedSalesId) {
        countQuery = countQuery.eq('assigned_sales_id', normalizedFilters.assignedSalesId);
      }

      if (normalizedFilters.search) {
        countQuery = countQuery.or(
          `company_name.ilike.%${normalizedFilters.search}%,contact_person.ilike.%${normalizedFilters.search}%,phone.ilike.%${normalizedFilters.search}%`
        );
      }

      const { count } = await countQuery;

      // Build data query (exclude soft-deleted, show newest first)
      let query = supabase
        .from('customers')
        .select('*, assigned_sales:profiles!assigned_sales_id(full_name)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (normalizedFilters.assignedSalesId) {
        query = query.eq('assigned_sales_id', normalizedFilters.assignedSalesId);
      }

      if (normalizedFilters.search) {
        query = query.or(
          `company_name.ilike.%${normalizedFilters.search}%,contact_person.ilike.%${normalizedFilters.search}%,phone.ilike.%${normalizedFilters.search}%`
        );
      }

      query = query.range(from, to);

      const { data, error } = await query;
      if (error) throw error;

      return {
        data: data as any[],
        totalCount: count ?? 0,
        page: pageParam,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((sum, page) => sum + page.data.length, 0);
      if (loadedCount >= lastPage.totalCount) return undefined;
      if (lastPage.data.length < pageSize) return undefined;
      return lastPage.page + 1;
    },
  });
}

// Export all customers without pagination (for export functionality)
export async function fetchAllCustomers(search?: string): Promise<Customer[]> {
  const PAGE_SIZE = 1000;
  let allData: Customer[] = [];
  let page = 0;

  while (true) {
    let query = supabase
      .from('customers')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,contact_person.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    
    if (error) throw error;
    if (!data?.length) break;
    
    allData = [...allData, ...data];
    
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return allData;
}

export function useCustomer(id: string | undefined, includeDeleted = false) {
  return useQuery({
    queryKey: ['customer', id, includeDeleted],
    queryFn: async () => {
      if (!id) return null;
      
      let query = supabase
        .from('customers')
        .select('*, assigned_sales:profiles!assigned_sales_id(full_name)')
        .eq('id', id);

      // Only filter by deleted_at if not including deleted items
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data as Customer | null;
    },
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customer: Omit<CustomerInsert, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>) => {
      await ensureFreshSession();

      const rpcArgs = {
        p_company_name: customer.company_name,
        p_phone: customer.phone,
        p_contact_person: (customer as any).contact_person ?? null,
        p_email: (customer as any).email ?? null,
        p_address: (customer as any).address ?? null,
        p_city: (customer as any).city ?? null,
        p_state: (customer as any).state ?? null,
        p_pincode: (customer as any).pincode ?? null,
        p_gst_number: (customer as any).gst_number ?? null,
        p_is_b2b: (customer as any).is_b2b ?? true,
        p_assigned_sales_id: (customer as any).assigned_sales_id ?? null,
        p_office_id: (customer as any).office_id ?? null,
        p_industry_tag: (customer as any).industry_tag ?? null,
        p_notes: (customer as any).notes ?? null,
      } as any;

      let { data, error } = await supabase.rpc('create_customer_safe', rpcArgs);

      // Auto-heal stale-JWT cases by refreshing once and retrying
      if (error && isPermissionError(error)) {
        try {
          await supabase.auth.refreshSession();
          await ensureFreshSession();
        } catch {}
        ({ data, error } = await supabase.rpc('create_customer_safe', rpcArgs));
      }

      if (error) throw error;
      return data as Customer;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created successfully');
      logActivity({
        action: 'create',
        entityType: 'customer',
        entityId: data.id,
        entityName: data.company_name,
      });
    },
    onError: (error: any) => {
      // Surface the exact failure so support can diagnose without guessing
      // (especially when stale published bundles bypass the RPC path).
      // eslint-disable-next-line no-console
      console.error('[useCreateCustomer] create_customer_safe failed:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });

      let message = 'Failed to create customer';
      const msg = (error as Error)?.message || '';
      const lower = msg.toLowerCase();
      const code = (error as any)?.code ? ` [${(error as any).code}]` : '';
      const hint = (error as any)?.hint ? ` Hint: ${(error as any).hint}` : '';

      if (msg.includes('NO_ORGANIZATION') || lower.includes('no organization found')) {
        message = "Your account isn't linked to an organization yet. Please contact your admin to be added before creating customers.";
      } else if (msg.includes('DUPLICATE_PHONE_OTHER_TENANT')) {
        message = 'A customer with this phone or GST already exists in another organization and cannot be reused.';
      } else if (lower.includes('jwt') || lower.includes('invalid token') || lower.includes('not authenticated')) {
        message = 'Your session has expired. Please log out and log back in.';
      } else if (lower.includes('violates foreign key') || lower.includes('is_same_tenant')) {
        message = 'The selected sales person belongs to a different organization. Please pick a teammate from your organization.';
      } else if (lower.includes('network') || lower.includes('failed to fetch')) {
        message = 'Network error. Please check your connection and try again.';
      } else if (lower.includes('timeout')) {
        message = 'Request timed out. Please try again.';
      } else {
        message = `Failed to create customer${code}: ${msg}${hint}`;
      }

      toast.error(message);
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: CustomerUpdate & { id: string }) => {
      await ensureFreshSession();
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', data.id] });
      toast.success('Customer updated successfully');
      logActivity({
        action: 'update',
        entityType: 'customer',
        entityId: data.id,
        entityName: data.company_name,
      });
    },
    onError: (error: Error) => {
      let message = 'Failed to update customer';
      
      if (error.message.includes('violates unique constraint')) {
        message = 'Another customer with this phone number or GST already exists';
      } else if (error.message.includes('violates foreign key')) {
        message = 'Invalid sales person selected';
      } else if (error.message.includes('permission denied') || error.message.includes('row-level security')) {
        message = 'You do not have permission to update this customer';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        message = 'Network error. Please check your connection';
      } else {
        message = `Failed to update customer: ${error.message}`;
      }
      
      toast.error(message);
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete using the database function
      const { error } = await supabase.rpc('soft_delete_customer', { customer_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['deleted-customers'] });
      toast.success('Customer moved to trash');
      logActivity({
        action: 'delete',
        entityType: 'customer',
        entityId: id,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to delete customer: ' + error.message);
    },
  });
}

export function useRestoreCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('restore_customer', { customer_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['deleted-customers'] });
      toast.success('Customer restored successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to restore customer: ' + error.message);
    },
  });
}

export function useDeletedCustomers() {
  return useQuery({
    queryKey: ['deleted-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function usePermanentDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('hard_delete_customer', { customer_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['deleted-customers'] });
      toast.success('Customer permanently deleted');
      logActivity({
        action: 'delete',
        entityType: 'customer',
        entityId: id,
        metadata: { permanent: true },
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to permanently delete customer: ' + error.message);
    },
  });
}

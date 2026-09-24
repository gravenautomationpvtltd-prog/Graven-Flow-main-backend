import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type ReportType = 'leads' | 'orders' | 'invoices' | 'customers' | 'inventory';

export interface ScheduledReport {
  id: string;
  name: string;
  report_type: ReportType;
  filters: Record<string, any>;
  schedule: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  last_sent_at: string | null;
  next_send_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduledReportInput {
  name: string;
  report_type: ReportType;
  filters?: Record<string, any>;
  schedule: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
}

export function useScheduledReports() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['scheduled-reports', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('scheduled_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ScheduledReport[];
    },
    enabled: !!user,
  });
}

export function useCreateScheduledReport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateScheduledReportInput) => {
      if (!user) throw new Error('Not authenticated');

      // Calculate next_send_at based on schedule
      const now = new Date();
      let nextSend: Date;
      switch (input.schedule) {
        case 'daily':
          nextSend = new Date(now.setDate(now.getDate() + 1));
          nextSend.setHours(8, 0, 0, 0);
          break;
        case 'weekly':
          nextSend = new Date(now.setDate(now.getDate() + 7));
          nextSend.setHours(8, 0, 0, 0);
          break;
        case 'monthly':
          nextSend = new Date(now.setMonth(now.getMonth() + 1));
          nextSend.setDate(1);
          nextSend.setHours(8, 0, 0, 0);
          break;
      }

      const { data, error } = await supabase
        .from('scheduled_reports')
        .insert({
          name: input.name,
          report_type: input.report_type,
          filters: input.filters || {},
          schedule: input.schedule,
          recipients: input.recipients,
          next_send_at: nextSend.toISOString(),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast.success('Scheduled report created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create scheduled report: ' + error.message);
    },
  });
}

export function useToggleScheduledReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('scheduled_reports')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast.success('Schedule updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update schedule: ' + error.message);
    },
  });
}

export function useDeleteScheduledReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      toast.success('Scheduled report deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete scheduled report: ' + error.message);
    },
  });
}

// Report data fetching hooks
export function useLeadsReportData(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['reports', 'leads', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select(`
          *,
          customer:customers(company_name, contact_person),
          assigned_user:profiles!leads_assigned_to_fkey(full_name)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useOrdersReportData(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['reports', 'orders', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('sales_orders')
        .select(`
          *,
          customer:customers(company_name, contact_person),
          created_by_user:profiles!sales_orders_created_by_fkey(full_name)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useInvoicesReportData(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['reports', 'invoices', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(company_name, contact_person)
        `)
        .order('invoice_date', { ascending: false });

      if (startDate) {
        query = query.gte('invoice_date', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        query = query.lte('invoice_date', endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCustomersReportData() {
  return useQuery({
    queryKey: ['reports', 'customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          assigned_sales:profiles!customers_assigned_sales_id_fkey(full_name),
          office:offices(name)
        `)
        .order('company_name', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useInventoryReportData() {
  return useQuery({
    queryKey: ['reports', 'inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          product:products(name, hsn_code, default_rate),
          office:offices(name)
        `)
        .order('quantity', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserTenantId } from '@/utils/tenantUtils';

export function useGstSettings() {
  return useQuery({
    queryKey: ['gst-settings'],
    queryFn: async () => {
      const tenantId = await getUserTenantId();
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('gst_api_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveGstSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: {
      tenant_id: string;
      gstin: string;
      gsp_provider?: string;
      provider_mode?: 'gsp' | 'direct_irp';
      irp_base_url?: string;
      client_id?: string;
      client_secret?: string;
      api_username?: string;
      api_password?: string;
      sandbox_mode?: boolean;
      auto_generate_einvoice?: boolean;
      auto_generate_eway_bill?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('gst_api_settings')
        .upsert(settings, { onConflict: 'tenant_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gst-settings'] });
      toast.success('GST settings saved');
    },
    onError: (err: Error) => toast.error('Failed to save: ' + err.message),
  });
}

export function useGenerateEInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-einvoice', {
        body: { invoice_id: invoiceId },
      });

      const describe = (payload: { error?: string; problems?: unknown }) => {
        const problems = Array.isArray(payload?.problems) ? (payload.problems as string[]) : [];
        const base = payload?.error || 'E-Invoice generation failed';
        return problems.length > 0 ? `${base}\n• ${problems.join('\n• ')}` : base;
      };

      if (error) {
        // Edge function returned a non-2xx: read the JSON body for readable problems
        let body: { error?: string; problems?: unknown } | null = null;
        try {
          body = await (error as { context?: Response }).context?.clone().json();
        } catch {
          body = null;
        }
        throw body ? new Error(describe(body)) : error;
      }
      if (data?.error) throw new Error(describe(data));
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['finance-order-details'] });
      toast.success(`E-Invoice generated! IRN: ${data.irn}`);
    },
    onError: (err: Error) => toast.error('E-Invoice failed: ' + err.message),
  });
}

export function useGenerateEwayBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      dispatch_id: string;
      transporter_name: string;
      transporter_id?: string;
      vehicle_number: string;
      vehicle_type?: string;
      transport_mode?: string;
      distance: number;
      invoice_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-eway-bill', {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['finance-order-details'] });
      toast.success(`E-Way Bill generated! No: ${data.eway_bill_number}`);
    },
    onError: (err: Error) => toast.error('E-Way Bill failed: ' + err.message),
  });
}

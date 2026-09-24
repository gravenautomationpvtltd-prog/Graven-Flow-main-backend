import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { requireTenantId } from '@/utils/tenantUtils';

export interface SavedShippingLabel {
  id: string;
  dispatch_id: string;
  box_count: number;
  label_data: any;
  file_name: string | null;
  file_url: string | null;
  generated_by: string | null;
  generated_at: string;
  updated_at: string;
  generator?: { full_name: string } | null;
}

export function useShippingLabel(dispatchId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['shipping-label', dispatchId],
    enabled: !!dispatchId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_labels')
        .select('*')
        .eq('dispatch_id', dispatchId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      let generator: { full_name: string } | null = null;
      if ((data as any).generated_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', (data as any).generated_by)
          .maybeSingle();
        generator = (profile as any) ?? null;
      }
      return { ...(data as any), generator } as SavedShippingLabel;
    },
  });
}

export function useSaveShippingLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dispatchId,
      blob,
      fileName,
      boxCount,
      labelData,
    }: {
      dispatchId: string;
      blob: Blob;
      fileName: string;
      boxCount: number;
      labelData: unknown;
    }) => {
      const tenantId = await requireTenantId();
      const { data: { user } } = await supabase.auth.getUser();

      const filePath = `${dispatchId}/shipping-labels.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('dispatch-documents')
        .upload(filePath, blob, { upsert: true, contentType: 'application/pdf' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('dispatch-documents')
        .getPublicUrl(filePath);

      const { error } = await supabase
        .from('shipping_labels')
        .upsert(
          {
            tenant_id: tenantId,
            dispatch_id: dispatchId,
            box_count: boxCount,
            label_data: labelData as any,
            file_name: fileName,
            // cache-buster so a regenerated file isn't served stale
            file_url: `${publicUrl}?v=${Date.now()}`,
            generated_by: user?.id ?? null,
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'dispatch_id' },
        );
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shipping-label', variables.dispatchId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Labels downloaded, but not saved',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

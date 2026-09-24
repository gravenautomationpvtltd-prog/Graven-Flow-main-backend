import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { requireTenantId } from '@/utils/tenantUtils';
import { ensureFreshSession } from '@/utils/sessionGuard';
import { toast } from 'sonner';

const BUCKET = 'tender-documents';

export const TENDER_DOC_TYPES = [
  'tender_notice',
  'technical_bid',
  'financial_bid',
  'emd_proof',
  'corrigendum',
  'award_letter',
  'other',
] as const;

export function useTenderDocuments(tenderId?: string) {
  return useQuery({
    queryKey: ['tender-documents', tenderId],
    enabled: !!tenderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tender_documents')
        .select('*')
        .eq('tender_id', tenderId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUploadTenderDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ tenderId, file, documentType }: { tenderId: string; file: File; documentType: string }) => {
      await ensureFreshSession();
      if (!user) throw new Error('Please sign in again.');
      const tenantId = await requireTenantId();
      const path = `${tenantId}/${tenderId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from('tender_documents').insert({
        tenant_id: tenantId,
        tender_id: tenderId,
        document_type: documentType,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        uploaded_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tender-documents', variables.tenderId] });
      toast.success('Document uploaded');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteTenderDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string; tenderId: string }) => {
      await ensureFreshSession();
      await supabase.storage.from(BUCKET).remove([filePath]);
      const { error } = await supabase.from('tender_documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tender-documents', variables.tenderId] });
      toast.success('Document removed');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export async function openTenderDocument(filePath: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 300);
  if (error || !data?.signedUrl) {
    toast.error('Could not open the document');
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener');
}

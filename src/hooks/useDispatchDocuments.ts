import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type DispatchDocumentType = Database['public']['Enums']['dispatch_document_type'];

export interface DispatchDocument {
  id: string;
  dispatch_id: string;
  document_type: DispatchDocumentType;
  file_name: string;
  file_url: string;
  uploaded_by: string | null;
  created_at: string;
  uploader?: {
    full_name: string;
  } | null;
}

export function useDispatchDocuments(dispatchId: string | undefined) {
  return useQuery({
    queryKey: ['dispatch-documents', dispatchId],
    queryFn: async () => {
      if (!dispatchId) return [];
      
      const { data, error } = await supabase
        .from('dispatch_documents')
        .select(`
          *,
          uploader:profiles!dispatch_documents_uploaded_by_fkey(full_name)
        `)
        .eq('dispatch_id', dispatchId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DispatchDocument[];
    },
    enabled: !!dispatchId,
  });
}

export function useUploadDispatchDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dispatchId,
      file,
      documentType,
    }: {
      dispatchId: string;
      file: File;
      documentType: DispatchDocumentType;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${dispatchId}-${documentType}-${Date.now()}.${fileExt}`;
      const filePath = `${dispatchId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('dispatch-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('dispatch-documents')
        .getPublicUrl(filePath);

      const { data: document, error: insertError } = await supabase
        .from('dispatch_documents')
        .insert({
          dispatch_id: dispatchId,
          document_type: documentType,
          file_name: file.name,
          file_url: publicUrl,
          uploaded_by: user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return document;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-documents', variables.dispatchId] });
      toast({ title: 'Document uploaded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to upload document', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteDispatchDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dispatchId }: { id: string; dispatchId: string }) => {
      const { error } = await supabase
        .from('dispatch_documents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-documents', variables.dispatchId] });
      toast({ title: 'Document deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete document', description: error.message, variant: 'destructive' });
    },
  });
}

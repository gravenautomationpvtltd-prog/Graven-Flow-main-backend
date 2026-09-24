import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EnquiryAttachment {
  id: string;
  enquiry_item_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  parsed_data: Record<string, unknown> | null;
  parsing_status: string | null;
  parsing_error: string | null;
}

export function useEnquiryItemAttachments(enquiryItemId: string | undefined) {
  return useQuery({
    queryKey: ['enquiry-attachments', enquiryItemId],
    queryFn: async () => {
      if (!enquiryItemId) return [];
      
      const { data, error } = await supabase
        .from('enquiry_item_attachments')
        .select('*')
        .eq('enquiry_item_id', enquiryItemId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EnquiryAttachment[];
    },
    enabled: !!enquiryItemId,
  });
}

export function useUploadEnquiryAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      enquiryItemId,
      leadId,
    }: {
      file: File;
      enquiryItemId: string;
      leadId: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${leadId}/${enquiryItemId}/${timestamp}-${sanitizedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('enquiry-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('enquiry-attachments')
        .getPublicUrl(filePath);

      const { data, error } = await supabase
        .from('enquiry_item_attachments')
        .insert({
          enquiry_item_id: enquiryItemId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type || null,
          file_size: file.size,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as EnquiryAttachment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-attachments', variables.enquiryItemId] });
      queryClient.invalidateQueries({ queryKey: ['enquiry-attachment-counts'] });
    },
    onError: (error) => {
      console.error('Error uploading attachment:', error);
      toast.error('Failed to upload attachment');
    },
  });
}

export function useDeleteEnquiryAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachment: EnquiryAttachment) => {
      const url = new URL(attachment.file_url);
      const pathMatch = url.pathname.match(/\/enquiry-attachments\/(.+)$/);
      
      if (pathMatch) {
        const filePath = decodeURIComponent(pathMatch[1]);
        await supabase.storage.from('enquiry-attachments').remove([filePath]);
      }

      const { error } = await supabase
        .from('enquiry_item_attachments')
        .delete()
        .eq('id', attachment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-attachments'] });
      queryClient.invalidateQueries({ queryKey: ['enquiry-attachment-counts'] });
      toast.success('Attachment deleted');
    },
    onError: (error) => {
      console.error('Error deleting attachment:', error);
      toast.error('Failed to delete attachment');
    },
  });
}

export function useEnquiryAttachmentCounts(enquiryItemIds: string[]) {
  return useQuery({
    queryKey: ['enquiry-attachment-counts', enquiryItemIds],
    queryFn: async () => {
      if (enquiryItemIds.length === 0) return {};

      const { data, error } = await supabase
        .from('enquiry_item_attachments')
        .select('enquiry_item_id')
        .in('enquiry_item_id', enquiryItemIds);

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        counts[row.enquiry_item_id] = (counts[row.enquiry_item_id] || 0) + 1;
      });
      return counts;
    },
    enabled: enquiryItemIds.length > 0,
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useParseAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attachmentId,
      fileUrl,
      fileName,
      fileType,
    }: {
      attachmentId: string;
      fileUrl: string;
      fileName: string;
      fileType: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke('parse-enquiry-attachment', {
        body: { attachmentId, fileUrl, fileName, fileType },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to parse attachment');
      
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-attachments'] });
      toast.success('File parsed successfully');
    },
    onError: (error: Error) => {
      console.error('Error parsing attachment:', error);
      if (error.message.includes('Rate limit')) {
        toast.error('AI rate limit reached. Please try again later.');
      } else if (error.message.includes('credits')) {
        toast.error('AI credits exhausted. Please add credits in Settings.');
      } else {
        toast.error('Failed to parse file: ' + error.message);
      }
    },
  });
}

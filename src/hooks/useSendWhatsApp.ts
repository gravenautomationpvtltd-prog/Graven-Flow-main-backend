import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

interface SendWhatsAppParams {
  destination: string;
  templateName: string;
  templateParams?: {
    userName?: string;
    params?: string[];
    media?: Record<string, any>;
    buttons?: any[];
    components?: any[];
    fallbackValues?: Record<string, string>;
  };
  leadId?: string;
}

export function useSendWhatsApp() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: SendWhatsAppParams) => {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          ...params,
          userId: user?.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to send message');
      
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success('WhatsApp message sent successfully');
      if (variables.leadId) {
        queryClient.invalidateQueries({ queryKey: ['activities', variables.leadId] });
        queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to send WhatsApp: ${error.message}`);
    },
  });
}

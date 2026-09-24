import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OutreachTemplate {
  id: string;
  name: string;
  channel: 'email' | 'whatsapp';
  subject: string | null;
  body: string;
  whatsapp_template_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CustomerOutreach {
  id: string;
  customer_id: string;
  campaign_date: string;
  email_sent_at: string | null;
  whatsapp_sent_at: string | null;
  email_response_at: string | null;
  whatsapp_response_at: string | null;
  lead_id: string | null;
  email_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  customer?: {
    company_name: string;
    contact_person: string | null;
    email: string | null;
    phone: string;
  };
}

interface OutreachStats {
  totalCustomers: number;
  customersWithEmail: number;
  customersWithSalesperson: number;
  recentOutreachCount: number;
  responsesCount: number;
  leadsGenerated: number;
}

export function useOutreachTemplates() {
  return useQuery({
    queryKey: ['outreach-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_templates')
        .select('*')
        .order('channel', { ascending: true });

      if (error) throw error;
      return data as OutreachTemplate[];
    },
  });
}

export function useEnquiryTemplate(channel: 'email' | 'whatsapp') {
  return useQuery({
    queryKey: ['enquiry-template', channel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_templates')
        .select('*')
        .eq('channel', channel)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as OutreachTemplate | null;
    },
  });
}

export function useUpdateOutreachTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OutreachTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('outreach_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-templates'] });
      toast.success('Template updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update template: ' + error.message);
    },
  });
}

export function useCustomerOutreachHistory(limit = 50) {
  return useQuery({
    queryKey: ['customer-outreach-history', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_outreach')
        .select(`
          *,
          customer:customers(company_name, contact_person, email, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as CustomerOutreach[];
    },
  });
}

export function useOutreachStats() {
  return useQuery({
    queryKey: ['outreach-stats'],
    queryFn: async () => {
      // Get customer counts
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      const { count: customersWithEmail } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .not('email', 'is', null);

      const { count: customersWithSalesperson } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .not('assigned_sales_id', 'is', null);

      // Get outreach stats from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentOutreachCount } = await supabase
        .from('customer_outreach')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { count: responsesCount } = await supabase
        .from('customer_outreach')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'responded')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { count: leadsGenerated } = await supabase
        .from('customer_outreach')
        .select('*', { count: 'exact', head: true })
        .not('lead_id', 'is', null)
        .gte('created_at', thirtyDaysAgo.toISOString());

      return {
        totalCustomers: totalCustomers || 0,
        customersWithEmail: customersWithEmail || 0,
        customersWithSalesperson: customersWithSalesperson || 0,
        recentOutreachCount: recentOutreachCount || 0,
        responsesCount: responsesCount || 0,
        leadsGenerated: leadsGenerated || 0,
      } as OutreachStats;
    },
  });
}

export function useCustomerOutreachHistoryByCustomer(customerId: string) {
  return useQuery({
    queryKey: ['customer-outreach-history', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_outreach')
        .select(`
          *,
          lead:leads(id, title, status)
        `)
        .eq('customer_id', customerId)
        .order('campaign_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });
}

export function useMarkOutreachResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ outreachId, channel }: { outreachId: string; channel: 'email' | 'whatsapp' }) => {
      const updateData = channel === 'whatsapp'
        ? { whatsapp_response_at: new Date().toISOString(), status: 'responded' }
        : { email_response_at: new Date().toISOString(), status: 'responded' };

      const { data, error } = await supabase
        .from('customer_outreach')
        .update(updateData)
        .eq('id', outreachId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-outreach-history'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
      toast.success('Response marked successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to mark response: ' + error.message);
    },
  });
}

export function useTriggerOutreach() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      batchSize?: number;
      channels?: ('email' | 'whatsapp')[];
      daysGap?: number;
      testMode?: boolean;
      testCustomerId?: string;
      whatsappCampaignName?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('customer-outreach', {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customer-outreach-history'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
      toast.success(`Outreach complete: ${data.stats?.emailsSent || 0} emails, ${data.stats?.whatsappSent || 0} WhatsApp sent`);
    },
    onError: (error: Error) => {
      toast.error('Failed to trigger outreach: ' + error.message);
    },
  });
}

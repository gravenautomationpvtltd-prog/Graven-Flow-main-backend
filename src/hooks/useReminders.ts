import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Reminder {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  title: string;
  description: string | null;
  due_at: string;
  remind_before_minutes: number;
  is_completed: boolean;
  completed_at: string | null;
  notification_sent: boolean;
  email_sent: boolean;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export interface CreateReminderInput {
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  title: string;
  description?: string;
  due_at: string;
  remind_before_minutes?: number;
  priority?: 'low' | 'medium' | 'high';
}

export function useReminders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['reminders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('due_at', { ascending: true });

      if (error) throw error;
      return data as Reminder[];
    },
    enabled: !!user,
  });
}

export function useUpcomingReminders(limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['reminders', 'upcoming', user?.id, limit],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .gte('due_at', new Date().toISOString())
        .order('due_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data as Reminder[];
    },
    enabled: !!user,
  });
}

export function usePendingRemindersCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['reminders', 'pending-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const now = new Date();
      const { count, error } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .lte('due_at', now.toISOString());

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 180000, // Refresh every 3 minutes (foreground only)
    refetchIntervalInBackground: false,
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateReminderInput) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          entity_name: input.entity_name || null,
          title: input.title,
          description: input.description || null,
          due_at: input.due_at,
          remind_before_minutes: input.remind_before_minutes || 30,
          priority: input.priority || 'medium',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Reminder created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create reminder: ' + error.message);
    },
  });
}

export function useCompleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reminders')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Reminder completed');
    },
    onError: (error: Error) => {
      toast.error('Failed to complete reminder: ' + error.message);
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Reminder deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete reminder: ' + error.message);
    },
  });
}

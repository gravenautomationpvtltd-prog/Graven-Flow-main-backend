import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { logActivity } from '@/lib/activity-logger';
import { ensureFreshSession } from '@/utils/sessionGuard';

type Task = Database['public']['Tables']['tasks']['Row'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['tasks']['Update'];
type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

interface TaskWithRelations extends Task {
  assigned_to_profile?: { id: string; full_name: string; email: string } | null;
  assigned_by_profile?: { id: string; full_name: string } | null;
  lead?: { id: string; title: string } | null;
  customer?: { id: string; company_name: string; contact_person: string | null } | null;
}

export function useTasks(filters?: { 
  status?: TaskStatus; 
  priority?: TaskPriority;
  search?: string;
  leadId?: string;
}) {
  const { user, isManager, isAdmin } = useAuth();
  const canViewAllTasks = isManager || isAdmin;

  return useQuery({
    queryKey: ['tasks', filters, user?.id, canViewAllTasks],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name, email),
          assigned_by_profile:profiles!tasks_assigned_by_fkey(id, full_name),
          lead:leads(id, title),
          customer:customers(id, company_name, contact_person)
        `)
        .order('created_at', { ascending: false });

      // Sales users can only see their own tasks
      if (!canViewAllTasks && user?.id) {
        query = query.eq('assigned_to', user.id);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }

      if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }

      if (filters?.leadId) {
        query = query.eq('lead_id', filters.leadId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TaskWithRelations[];
    },
    enabled: !!user?.id,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name, email),
          assigned_by_profile:profiles!tasks_assigned_by_fkey(id, full_name),
          lead:leads(id, title),
          customer:customers(id, company_name, contact_person)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as TaskWithRelations;
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (task: Omit<TaskInsert, 'assigned_by'>) => {
      await ensureFreshSession();
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...task,
          assigned_by: user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;

      // AUTO-LOG ACTIVITY: If task is linked to a lead, log it as activity
      if (task.lead_id && user?.id) {
        await supabase.from('activities').insert({
          lead_id: task.lead_id,
          user_id: user.id,
          activity_type: 'task',
          description: `Created task: ${task.title}`,
          metadata: { task_id: data.id, task_title: task.title },
        });

        // Update lead's last_activity_at to prevent false escalation
        await supabase
          .from('leads')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', task.lead_id);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (data.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['activities', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['lead', data.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      }
      toast.success('Task created successfully');
      logActivity({
        action: 'create',
        entityType: 'task',
        entityId: data.id,
        entityName: data.title,
      });
    },
    onError: (error) => {
      toast.error('Failed to create task: ' + error.message);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TaskUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', data.id] });
      toast.success('Task updated successfully');
      logActivity({
        action: 'update',
        entityType: 'task',
        entityId: data.id,
        entityName: data.title,
      });
    },
    onError: (error) => {
      toast.error('Failed to update task: ' + error.message);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted successfully');
      logActivity({
        action: 'delete',
        entityType: 'task',
        entityId: id,
      });
    },
    onError: (error) => {
      toast.error('Failed to delete task: ' + error.message);
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'completed' as TaskStatus,
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', data.id] });
      toast.success('Task marked as completed');
    },
    onError: (error) => {
      toast.error('Failed to complete task: ' + error.message);
    },
  });
}

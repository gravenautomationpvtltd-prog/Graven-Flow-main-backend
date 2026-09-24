import { useState } from 'react';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';
import { 
  ListTodo, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Circle, 
  AlertCircle,
  Loader2,
  CalendarClock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCompleteTask, useUpdateTask } from '@/hooks/useTasks';
import { ViewTaskDialog } from '@/components/tasks/ViewTaskDialog';
import { EditTaskDialog } from '@/components/tasks/EditTaskDialog';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus | null;
  priority: TaskPriority | null;
  due_date: string | null;
  created_at?: string;
  completed_at?: string | null;
  lead_id?: string | null;
  customer_id?: string | null;
  assigned_to_profile?: { id?: string; full_name: string; email?: string; avatar_url?: string | null } | null;
  assigned_by_profile?: { id?: string; full_name: string } | null;
  lead?: { id: string; title: string } | null;
  customer?: { id: string; company_name: string } | null;
}

interface LeadTasksSectionProps {
  tasks: Task[];
  isLoading?: boolean;
  onCreateTask: () => void;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  medium: { label: 'Medium', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  high: { label: 'High', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  urgent: { label: 'Urgent', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

const statusIcons: Record<string, typeof Circle> = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
  cancelled: AlertCircle,
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function LeadTasksSection({ tasks, isLoading, onCreateTask }: LeadTasksSectionProps) {
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  const completeTask = useCompleteTask();
  const updateTask = useUpdateTask();

  const handleCompleteTask = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    updateTask.mutate(
      { id: taskId, status: 'completed', completed_at: new Date().toISOString() },
      {
        onSuccess: () => {
          toast.success('Task marked as complete');
        },
      }
    );
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setViewDialogOpen(true);
  };

  const handleEditFromView = (task: Task) => {
    setViewDialogOpen(false);
    setSelectedTask(task);
    setEditDialogOpen(true);
  };

  const isOverdue = (dueDate: string | null, status: TaskStatus | null) => {
    if (!dueDate || status === 'completed' || status === 'cancelled') return false;
    return isPast(parseISO(dueDate));
  };

  const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

  if (isLoading) {
    return (
      <Card className="shadow-sm border-border/50 rounded-xl overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <ListTodo className="h-4 w-4 text-primary" />
            </div>
            Related Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare task for dialogs with required fields
  const prepareTaskForDialog = (task: Task) => ({
    ...task,
    description: task.description || null,
    created_at: task.created_at || new Date().toISOString(),
    completed_at: task.completed_at || null,
    lead_id: task.lead_id || null,
    customer_id: task.customer_id || null,
    assigned_to_profile: task.assigned_to_profile ? {
      id: task.assigned_to_profile.id || '',
      full_name: task.assigned_to_profile.full_name,
      email: task.assigned_to_profile.email || '',
      avatar_url: task.assigned_to_profile.avatar_url,
    } : null,
    assigned_by_profile: task.assigned_by_profile ? {
      id: task.assigned_by_profile.id || '',
      full_name: task.assigned_by_profile.full_name,
    } : null,
  });

  return (
    <>
      <Card className="shadow-sm border-border/50 rounded-xl overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <ListTodo className="h-4 w-4 text-primary" />
              </div>
              Related Tasks
              {tasks.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {pendingTasks.length} pending
                </span>
              )}
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCreateTask}
              className="h-8 px-2"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <CalendarClock className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h4 className="text-sm font-medium text-foreground mb-1">No tasks yet</h4>
              <p className="text-xs text-muted-foreground max-w-[180px] mb-4">
                Create tasks to track follow-ups and actions for this lead
              </p>
              <Button variant="outline" size="sm" onClick={onCreateTask}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create Task
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.slice(0, 5).map((task, index) => {
                const status = task.status || 'pending';
                const priority = task.priority || 'medium';
                const StatusIcon = statusIcons[status] || Circle;
                const overdue = isOverdue(task.due_date, task.status);
                const isCompleted = status === 'completed';

                return (
                  <div 
                    key={task.id} 
                    onClick={() => handleViewTask(task)}
                    className={`group relative p-3 rounded-lg border transition-all duration-200 hover:shadow-sm animate-fade-in cursor-pointer ${
                      isCompleted 
                        ? 'bg-muted/30 border-border/30' 
                        : overdue 
                          ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/30' 
                          : 'bg-card border-border/50 hover:border-border'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Status Icon / Complete Button */}
                      <button
                        onClick={(e) => !isCompleted && handleCompleteTask(e, task.id)}
                        disabled={isCompleted || completeTask.isPending}
                        className={`flex-shrink-0 mt-0.5 transition-colors ${
                          isCompleted 
                            ? 'text-green-500 cursor-default' 
                            : 'text-muted-foreground hover:text-green-500'
                        }`}
                      >
                        <StatusIcon className="h-5 w-5" />
                      </button>

                      {/* Task Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {task.title}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] h-5 ${priorityConfig[priority]?.className}`}>
                            {priorityConfig[priority]?.label}
                          </Badge>
                          
                          {task.due_date && (
                            <span className={`text-xs flex items-center gap-1 ${
                              overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'
                            }`}>
                              <Clock className="h-3 w-3" />
                              {overdue ? 'Overdue' : formatDistanceToNow(parseISO(task.due_date), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Assignee Avatar */}
                      {task.assigned_to_profile && (
                        <Avatar className="h-6 w-6 flex-shrink-0">
                          <AvatarImage src={task.assigned_to_profile.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-muted">
                            {getInitials(task.assigned_to_profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {tasks.length > 5 && (
                <p className="text-xs text-center text-muted-foreground pt-2">
                  +{tasks.length - 5} more tasks
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Task Dialog */}
      <ViewTaskDialog
        task={selectedTask ? prepareTaskForDialog(selectedTask) : null}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        onEdit={(task) => handleEditFromView(task as Task)}
      />

      {/* Edit Task Dialog */}
      <EditTaskDialog
        task={selectedTask ? prepareTaskForDialog(selectedTask) : null}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  );
}

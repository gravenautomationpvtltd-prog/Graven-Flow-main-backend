import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2,
  Calendar,
  User,
  UserCheck,
  Building2,
  FileText,
  Pencil,
  RotateCcw
} from 'lucide-react';
import { useCompleteTask, useUpdateTask } from '@/hooks/useTasks';
import type { Database } from '@/integrations/supabase/types';

type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus | null;
  priority: TaskPriority | null;
  due_date: string | null;
  created_at: string;
  updated_at?: string;
  completed_at: string | null;
  lead_id: string | null;
  customer_id?: string | null;
  assigned_to_profile?: { id: string; full_name: string; email: string; avatar_url?: string | null } | null;
  assigned_by_profile?: { id: string; full_name: string } | null;
  lead?: { id: string; title: string } | null;
  customer?: { id: string; company_name: string } | null;
}

interface ViewTaskDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (task: Task) => void;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  medium: { label: 'Medium', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' },
  in_progress: { label: 'In Progress', icon: Loader2, className: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
  cancelled: { label: 'Cancelled', icon: AlertTriangle, className: 'text-muted-foreground bg-muted' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ViewTaskDialog({ task, open, onOpenChange, onEdit }: ViewTaskDialogProps) {
  const completeTask = useCompleteTask();
  const updateTask = useUpdateTask();

  if (!task) return null;

  const status = task.status || 'pending';
  const priority = task.priority || 'medium';
  const StatusIcon = statusConfig[status]?.icon || Clock;
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';

  const isOverdue = () => {
    if (!task.due_date || isCompleted || isCancelled) return false;
    return new Date(task.due_date) < new Date();
  };

  const handleComplete = () => {
    completeTask.mutate(task.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const handleReopen = () => {
    updateTask.mutate({ id: task.id, status: 'pending', completed_at: null }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-8">Task Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Title and Description */}
          <div>
            <h3 className="text-lg font-semibold mb-1">{task.title}</h3>
            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}
          </div>

          {/* Status and Priority */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusConfig[status]?.className}`}>
              <StatusIcon className="h-4 w-4" />
              <span className="text-sm font-medium">{statusConfig[status]?.label}</span>
            </div>
            <Badge variant="secondary" className={priorityConfig[priority]?.className}>
              {priorityConfig[priority]?.label} Priority
            </Badge>
          </div>

          {/* Due Date */}
          {task.due_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className={`text-sm ${isOverdue() ? 'text-red-600 font-medium' : ''}`}>
                Due: {format(new Date(task.due_date), 'MMM d, yyyy h:mm a')}
                {isOverdue() && <span className="ml-1">(Overdue)</span>}
              </span>
            </div>
          )}

          {/* Assigned To */}
          {task.assigned_to_profile && (
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={task.assigned_to_profile.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(task.assigned_to_profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{task.assigned_to_profile.full_name}</p>
                  <p className="text-xs text-muted-foreground">{task.assigned_to_profile.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Assigned By */}
          {task.assigned_by_profile && (
            <div className="flex items-center gap-3">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Assigned by <span className="font-medium">{task.assigned_by_profile.full_name}</span>
              </span>
            </div>
          )}

          {/* Linked Customer */}
          {task.customer && (
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Link 
                to={`/customers/${task.customer.id}`}
                className="text-sm text-primary hover:underline"
              >
                {task.customer.company_name}
              </Link>
            </div>
          )}

          {/* Linked Lead */}
          {task.lead && (
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Link 
                to={`/leads/${task.lead.id}`}
                className="text-sm text-primary hover:underline"
              >
                {task.lead.title}
              </Link>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-3 border-t text-xs text-muted-foreground space-y-1">
            <p>Created: {format(new Date(task.created_at), 'MMM d, yyyy h:mm a')}</p>
            {task.completed_at && (
              <p>Completed: {format(new Date(task.completed_at), 'MMM d, yyyy h:mm a')}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t">
            {onEdit && !isCancelled && (
              <Button variant="outline" onClick={() => onEdit(task)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {isCompleted ? (
              <Button 
                variant="outline" 
                onClick={handleReopen}
                disabled={updateTask.isPending}
              >
                {updateTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <RotateCcw className="h-4 w-4 mr-2" />
                Reopen
              </Button>
            ) : !isCancelled && (
              <Button onClick={handleComplete} disabled={completeTask.isPending}>
                {completeTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

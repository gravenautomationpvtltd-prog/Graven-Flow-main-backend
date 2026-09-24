import { format } from 'date-fns';
import { CheckCircle2, Clock, MoreVertical, AlertTriangle, Loader2, Eye, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCompleteTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus | null;
  priority: TaskPriority | null;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  lead_id: string | null;
  customer_id?: string | null;
  assigned_to_profile?: { id: string; full_name: string; email: string; avatar_url?: string | null } | null;
  assigned_by_profile?: { id: string; full_name: string } | null;
  lead?: { id: string; title: string } | null;
  customer?: { id: string; company_name: string } | null;
}

interface TaskListTableProps {
  tasks: Task[];
  isLoading?: boolean;
  onViewTask?: (task: Task) => void;
  onEditTask?: (task: Task) => void;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  medium: { label: 'Medium', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'text-yellow-600' },
  in_progress: { label: 'In Progress', icon: Loader2, className: 'text-blue-600' },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'text-green-600' },
  cancelled: { label: 'Cancelled', icon: AlertTriangle, className: 'text-muted-foreground' },
};

export function TaskListTable({ tasks, isLoading, onViewTask, onEditTask }: TaskListTableProps) {
  const { isAdmin } = useAuth();
  const completeTask = useCompleteTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const isOverdue = (dueDate: string | null, status: TaskStatus | null) => {
    if (!dueDate || status === 'completed' || status === 'cancelled') return false;
    return new Date(dueDate) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No tasks found. Create your first task to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead>Related Lead</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const status = task.status || 'pending';
          const priority = task.priority || 'medium';
          const StatusIcon = statusConfig[status]?.icon || Clock;
          const overdue = isOverdue(task.due_date, task.status);

          return (
            <TableRow key={task.id} className={overdue ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
              <TableCell>
                <div className="space-y-1">
                  <button
                    onClick={() => onViewTask?.(task)}
                    className="font-medium text-left hover:text-primary hover:underline transition-colors"
                  >
                    {task.title}
                  </button>
                  {task.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {task.description}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className={`flex items-center gap-1.5 ${statusConfig[status]?.className}`}>
                  <StatusIcon className="h-4 w-4" />
                  <span className="text-sm">{statusConfig[status]?.label}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={priorityConfig[priority]?.className}>
                  {priorityConfig[priority]?.label}
                </Badge>
              </TableCell>
              <TableCell>
                {task.assigned_to_profile?.full_name || 'Unassigned'}
              </TableCell>
              <TableCell>
                {task.lead ? (
                  <Link 
                    to={`/leads/${task.lead.id}`}
                    className="text-primary hover:underline text-sm"
                  >
                    {task.lead.title}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell>
                {task.due_date ? (
                  <span className={overdue ? 'text-red-600 font-medium' : ''}>
                    {format(new Date(task.due_date), 'MMM d, yyyy h:mm a')}
                    {overdue && <span className="ml-1 text-xs">(Overdue)</span>}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onViewTask?.(task)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    {status !== 'cancelled' && (
                      <DropdownMenuItem onClick={() => onEditTask?.(task)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Task
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {status !== 'completed' && status !== 'cancelled' && (
                      <>
                        <DropdownMenuItem 
                          onClick={() => completeTask.mutate(task.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark Complete
                        </DropdownMenuItem>
                        {status === 'pending' && (
                          <DropdownMenuItem 
                            onClick={() => updateTask.mutate({ id: task.id, status: 'in_progress' })}
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            Start Task
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    {status === 'completed' && (
                      <DropdownMenuItem 
                        onClick={() => updateTask.mutate({ id: task.id, status: 'pending', completed_at: null })}
                      >
                        Reopen Task
                      </DropdownMenuItem>
                    )}
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => deleteTask.mutate(task.id)}
                        >
                          Delete Task
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

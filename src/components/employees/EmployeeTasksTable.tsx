import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmployeeTasks, DateRangeParam } from '@/hooks/useEmployeeStats';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  in_progress: 'bg-blue-500/10 text-blue-500',
  completed: 'bg-green-500/10 text-green-500',
  cancelled: 'bg-red-500/10 text-red-500',
};

const priorityColors: Record<string, string> = {
  low: 'bg-slate-500/10 text-slate-500',
  medium: 'bg-orange-500/10 text-orange-500',
  high: 'bg-red-500/10 text-red-500',
};

interface EmployeeTasksTableProps {
  employeeId: string;
  dateRange?: DateRangeParam;
}

export function EmployeeTasksTable({ employeeId, dateRange }: EmployeeTasksTableProps) {
  const { data: tasks, isLoading } = useEmployeeTasks(employeeId, dateRange);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!tasks?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No tasks assigned to this employee</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Related To</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.title}</TableCell>
              <TableCell>
                {task.lead?.title || task.customer?.company_name || '—'}
              </TableCell>
              <TableCell>
                <Badge className={statusColors[task.status] || ''}>
                  {task.status.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={priorityColors[task.priority] || ''}>
                  {task.priority}
                </Badge>
              </TableCell>
              <TableCell className={task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-500' : 'text-muted-foreground'}>
                {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '—'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(task.created_at), 'MMM d, yyyy')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

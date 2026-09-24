import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isBefore, parseISO, startOfDay } from 'date-fns';
import { AlertTriangle, ExternalLink, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useBIETeam } from '@/hooks/useBIEWork';
import {
  PRODUCT_ASSIGNMENT_STATUSES,
  PRODUCT_TASK_TYPES,
  useDeleteProductAssignment,
  useProductAssignments,
  useUpdateProductAssignment,
} from '@/hooks/useProductAssignments';

const priorityStyle: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-secondary text-secondary-foreground',
  high: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  urgent: 'bg-destructive/15 text-destructive',
};

const label = (value: string) => value.replace(/_/g, ' ');

export function ProductAssignmentsTable() {
  const { user, isBIEManager } = useAuth();
  const { data: assignments = [], isLoading } = useProductAssignments();
  const { data: people = [] } = useBIETeam();
  const updateAssignment = useUpdateProductAssignment();
  const deleteAssignment = useDeleteProductAssignment();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  const nameOf = (id: string | null) =>
    people.find((p) => p.id === id)?.full_name ?? (id === user?.id ? 'Me' : '—');

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assignments
      .filter((row) => (statusFilter === 'all' ? true : row.status === statusFilter))
      .filter((row) => (assigneeFilter === 'all' ? true : row.assigned_to === assigneeFilter))
      .filter((row) =>
        term
          ? `${row.product?.model_number ?? ''} ${row.product?.name ?? ''} ${row.note ?? ''}`
              .toLowerCase()
              .includes(term)
          : true,
      )
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
  }, [assignments, search, statusFilter, assigneeFilter]);

  const isOverdue = (row: { due_date: string | null; completed_at: string | null }) =>
    !!row.due_date && !row.completed_at && isBefore(parseISO(row.due_date), startOfDay(new Date()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product assignments"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PRODUCT_ASSIGNMENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>{label(status)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isBIEManager && (
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="sm:w-52"><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {people.map((person) => (
                <SelectItem key={person.id} value={person.id}>{person.full_name || person.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
                {isBIEManager && <TableHead>Assigned to</TableHead>}
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.product_id ? (
                      <Link to={`/products/${row.product_id}`} className="inline-flex items-center gap-1 hover:underline">
                        {row.product?.model_number || row.product?.name || 'Product'}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                    ) : (
                      'Product'
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {PRODUCT_TASK_TYPES.find((t) => t.value === row.task_type)?.label ?? label(row.task_type)}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.status}
                      onValueChange={(value) =>
                        updateAssignment.mutate({
                          id: row.id,
                          values: { status: value },
                          previousStatus: row.status,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRODUCT_ASSIGNMENT_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>{label(status)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded px-2 py-1 text-xs font-medium ${priorityStyle[row.priority] ?? ''}`}>
                      {row.priority}
                    </span>
                  </TableCell>
                  <TableCell className={isOverdue(row) ? 'font-medium text-destructive' : ''}>
                    {row.due_date ? format(parseISO(row.due_date), 'dd MMM yyyy') : '—'}
                    {isOverdue(row) && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}
                  </TableCell>
                  {isBIEManager && (
                    <TableCell>
                      <Select
                        value={row.assigned_to ?? ''}
                        onValueChange={(value) =>
                          updateAssignment.mutate({ id: row.id, values: { assigned_to: value } })
                        }
                      >
                        <SelectTrigger className="h-8 w-44"><SelectValue placeholder={nameOf(row.assigned_to)} /></SelectTrigger>
                        <SelectContent>
                          {people.map((person) => (
                            <SelectItem key={person.id} value={person.id}>{person.full_name || person.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                  <TableCell>
                    {isBIEManager && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove assignment"
                        onClick={() => deleteAssignment.mutate(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={isBIEManager ? 7 : 6} className="py-10 text-center text-muted-foreground">
                    {isLoading ? 'Loading…' : 'No product work assigned yet'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <Badge variant="secondary" className="mr-2">Tip</Badge>
        Assign product work from the Product Catalog — select products and choose “Assign work”.
      </p>
    </div>
  );
}

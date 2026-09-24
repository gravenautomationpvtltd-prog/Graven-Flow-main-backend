import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmployeeLeads, DateRangeParam } from '@/hooks/useEmployeeStats';

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-500',
  contacted: 'bg-purple-500/10 text-purple-500',
  engaged: 'bg-indigo-500/10 text-indigo-500',
  qualified: 'bg-cyan-500/10 text-cyan-500',
  proposal: 'bg-orange-500/10 text-orange-500',
  quoted: 'bg-amber-500/10 text-amber-500',
  negotiation: 'bg-yellow-500/10 text-yellow-500',
  won: 'bg-green-500/10 text-green-500',
  lost: 'bg-red-500/10 text-red-500',
};

interface EmployeeLeadsTableProps {
  employeeId: string;
  dateRange?: DateRangeParam;
}

export function EmployeeLeadsTable({ employeeId, dateRange }: EmployeeLeadsTableProps) {
  const navigate = useNavigate();
  const { data: leads, isLoading } = useEmployeeLeads(employeeId, dateRange);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!leads?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No leads assigned to this employee</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow 
              key={lead.id} 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => navigate(`/leads/${lead.id}`)}
            >
              <TableCell className="font-medium">{lead.title}</TableCell>
              <TableCell>{lead.customer?.company_name || '—'}</TableCell>
              <TableCell>
                <Badge className={statusColors[lead.status] || ''}>
                  {lead.status}
                </Badge>
              </TableCell>
              <TableCell className="capitalize">{lead.source.replace('_', ' ')}</TableCell>
              <TableCell>
                {lead.estimated_value 
                  ? `₹${lead.estimated_value.toLocaleString()}`
                  : '—'
                }
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(lead.created_at), 'MMM d, yyyy')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

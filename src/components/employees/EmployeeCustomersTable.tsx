import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmployeeCustomers, DateRangeParam } from '@/hooks/useEmployeeStats';
import { Building2, Mail, Phone } from 'lucide-react';
import { CopyableText, CopyablePhone, CopyableEmail } from '@/components/shared/CopyableText';

interface EmployeeCustomersTableProps {
  employeeId: string;
  dateRange?: DateRangeParam;
}

export function EmployeeCustomersTable({ employeeId, dateRange }: EmployeeCustomersTableProps) {
  const navigate = useNavigate();
  const { data: customers, isLoading } = useEmployeeCustomers(employeeId, dateRange);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!customers?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No customers assigned to this employee</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <div className="font-medium">
                      <CopyableText
                        text={customer.company_name}
                        onClickText={() => navigate(`/customers/${customer.id}`)}
                        textClassName="font-medium text-foreground"
                      />
                    </div>
                    {customer.contact_person && (
                      <div className="text-sm text-muted-foreground">
                        <CopyableText text={customer.contact_person} />
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {customer.email && (
                    <CopyableEmail email={customer.email} />
                  )}
                  {customer.phone && (
                    <CopyablePhone phone={customer.phone} />
                  )}
                </div>
              </TableCell>
              <TableCell>
                {customer.city && customer.state ? (
                  <CopyableText text={`${customer.city}, ${customer.state}`} />
                ) : (customer.city || customer.state) ? (
                  <CopyableText text={customer.city || customer.state || ''} />
                ) : '—'}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {customer.is_b2b ? 'B2B' : 'B2C'}
                </Badge>
              </TableCell>
              <TableCell>
                {customer.is_frozen ? (
                  <Badge variant="destructive">Frozen</Badge>
                ) : customer.is_priority ? (
                  <Badge className="bg-yellow-500/10 text-yellow-600">Priority</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(customer.created_at), 'MMM d, yyyy')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

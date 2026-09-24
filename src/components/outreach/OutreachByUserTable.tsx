import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Mail } from 'lucide-react';
import type { UserOutreachStats } from '@/hooks/useOutreachAnalytics';

interface OutreachByUserTableProps {
  data: UserOutreachStats[];
  isLoading: boolean;
}

export function OutreachByUserTable({ data, isLoading }: OutreachByUserTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No outreach data available for this period
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team Member</TableHead>
            <TableHead className="text-center">
              <div className="flex items-center justify-center gap-1">
                <MessageCircle className="h-4 w-4 text-green-500" />
                WhatsApp
              </div>
            </TableHead>
            <TableHead className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Mail className="h-4 w-4 text-blue-500" />
                Email
              </div>
            </TableHead>
            <TableHead className="text-center">Total Sent</TableHead>
            <TableHead className="text-center">Responses</TableHead>
            <TableHead className="text-center">Response Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.userId}>
              <TableCell className="font-medium">{row.userName}</TableCell>
              <TableCell className="text-center">{row.whatsappCount}</TableCell>
              <TableCell className="text-center">{row.emailCount}</TableCell>
              <TableCell className="text-center font-semibold">
                {row.whatsappCount + row.emailCount}
              </TableCell>
              <TableCell className="text-center">{row.responseCount}</TableCell>
              <TableCell className="text-center">
                <Badge 
                  variant={row.responseRate >= 10 ? 'default' : row.responseRate >= 5 ? 'secondary' : 'outline'}
                >
                  {row.responseRate.toFixed(1)}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

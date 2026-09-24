import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Mail, Check } from 'lucide-react';
import { format } from 'date-fns';
import type { OutreachRecord } from '@/hooks/useOutreachAnalytics';

interface OutreachLogTableProps {
  data: OutreachRecord[];
  isLoading: boolean;
}

export function OutreachLogTable({ data, isLoading }: OutreachLogTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No outreach activity for this period
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Sent By</TableHead>
            <TableHead className="text-center">Channel</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((record) => {
            const hasWhatsApp = !!record.whatsapp_sent_at;
            const hasEmail = !!record.email_sent_at;
            const hasResponse = record.email_response_at || record.whatsapp_response_at || record.status === 'responded';

            return (
              <TableRow key={record.id}>
                <TableCell className="text-muted-foreground">
                  {record.campaign_date ? format(new Date(record.campaign_date), 'MMM d, yyyy') : '-'}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{record.customer?.company_name || 'Unknown'}</div>
                  {record.customer?.contact_person && (
                    <div className="text-sm text-muted-foreground">{record.customer.contact_person}</div>
                  )}
                </TableCell>
                <TableCell>{record.sent_by?.full_name || 'System'}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    {hasWhatsApp && (
                      <div className="flex items-center gap-1 text-green-600">
                        <MessageCircle className="h-4 w-4" />
                        <span className="text-xs">
                          {record.whatsapp_sent_at && format(new Date(record.whatsapp_sent_at), 'HH:mm')}
                        </span>
                      </div>
                    )}
                    {hasEmail && (
                      <div className="flex items-center gap-1 text-blue-600">
                        <Mail className="h-4 w-4" />
                        <span className="text-xs">
                          {record.email_sent_at && format(new Date(record.email_sent_at), 'HH:mm')}
                        </span>
                      </div>
                    )}
                    {!hasWhatsApp && !hasEmail && '-'}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {hasResponse ? (
                    <Badge variant="default" className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      Responded
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Sent</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

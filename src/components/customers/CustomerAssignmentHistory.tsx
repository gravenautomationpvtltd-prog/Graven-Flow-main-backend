import { format, differenceInDays } from 'date-fns';
import { UserCheck, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerAssignmentHistory } from '@/hooks/useCustomerAssignmentHistory';

interface Props {
  customerId: string;
}

export function CustomerAssignmentHistory({ customerId }: Props) {
  const { data: history, isLoading } = useCustomerAssignmentHistory(customerId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-24" /></CardContent>
      </Card>
    );
  }

  if (!history?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-5 w-5" />
            Assignment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No assignment history recorded</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="h-5 w-5" />
          Assignment History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6 space-y-4">
          {/* Timeline line */}
          <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />

          {history.map((record) => {
            const from = new Date(record.assigned_from);
            const until = record.assigned_until ? new Date(record.assigned_until) : new Date();
            const days = differenceInDays(until, from);
            const isCurrent = !record.assigned_until;

            return (
              <div key={record.id} className="relative">
                {/* Timeline dot */}
                <div className={`absolute -left-[18px] top-1 h-3 w-3 rounded-full border-2 ${
                  isCurrent ? 'bg-primary border-primary' : 'bg-background border-muted-foreground/40'
                }`} />

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {record.profile_name || 'Unknown'}
                      </span>
                      {isCurrent && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">Current</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      {format(from, 'dd MMM yyyy')}
                      {' – '}
                      {isCurrent ? 'Present' : format(until, 'dd MMM yyyy')}
                      <span className="text-foreground/60">· {days} day{days !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

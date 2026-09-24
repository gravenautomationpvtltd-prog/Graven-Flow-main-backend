import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUpcomingReminders, usePendingRemindersCount, useCompleteReminder } from '@/hooks/useReminders';
import { Bell, Check, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export function UpcomingRemindersWidget() {
  const navigate = useNavigate();
  const { data: reminders = [], isLoading } = useUpcomingReminders(5);
  const { data: overdueCount = 0 } = usePendingRemindersCount();
  const { mutate: completeReminder } = useCompleteReminder();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          Loading...
        </CardContent>
      </Card>
    );
  }

  const totalCount = reminders.length + overdueCount;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Reminders
          </div>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {overdueCount} overdue
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalCount === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-4">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No upcoming reminders
          </div>
        ) : (
          <div className="space-y-2">
            {reminders.map((reminder) => {
              const isOverdue = isPast(new Date(reminder.due_at));
              return (
                <div
                  key={reminder.id}
                  className={cn(
                    'flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer group',
                    isOverdue && 'bg-destructive/5'
                  )}
                >
                  <div className={cn(
                    'shrink-0',
                    reminder.priority === 'high' ? 'text-destructive' :
                    reminder.priority === 'medium' ? 'text-amber-500' : 'text-blue-500'
                  )}>
                    {isOverdue ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{reminder.title}</p>
                    <p className={cn('text-xs', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                      {formatDistanceToNow(new Date(reminder.due_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      completeReminder(reminder.id);
                    }}
                  >
                    <Check className="h-4 w-4 text-green-500" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReminders, useCompleteReminder, useDeleteReminder, Reminder } from '@/hooks/useReminders';
import { Bell, Check, Trash2, Clock, AlertCircle, Calendar, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, format, isPast, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'high':
      return <Badge variant="destructive">High</Badge>;
    case 'medium':
      return <Badge variant="default">Medium</Badge>;
    case 'low':
      return <Badge variant="secondary">Low</Badge>;
    default:
      return null;
  }
};

const getEntityLink = (entityType: string, entityId: string) => {
  switch (entityType) {
    case 'lead':
      return `/leads/${entityId}`;
    case 'customer':
      return `/customers/${entityId}`;
    case 'task':
      return `/tasks`;
    case 'order':
      return `/orders`;
    default:
      return null;
  }
};

export function RemindersList() {
  const navigate = useNavigate();
  const { data: reminders = [], isLoading } = useReminders();
  const { mutate: completeReminder } = useCompleteReminder();
  const { mutate: deleteReminder } = useDeleteReminder();

  const activeReminders = reminders.filter(r => !r.is_completed);
  const completedReminders = reminders.filter(r => r.is_completed);

  const overdueReminders = activeReminders.filter(r => isPast(new Date(r.due_at)));
  const todayReminders = activeReminders.filter(r => !isPast(new Date(r.due_at)) && isToday(new Date(r.due_at)));
  const upcomingReminders = activeReminders.filter(r => !isPast(new Date(r.due_at)) && !isToday(new Date(r.due_at)));

  const handleReminderClick = (reminder: Reminder) => {
    const link = getEntityLink(reminder.entity_type, reminder.entity_id);
    if (link) {
      navigate(link);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading reminders...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          My Reminders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active" className="gap-2">
              Active
              {activeReminders.length > 0 && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  {activeReminders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              Completed
              {completedReminders.length > 0 && (
                <Badge variant="outline" className="text-xs h-5 px-1.5">
                  {completedReminders.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeReminders.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">No active reminders</p>
                <p className="text-sm">Your reminders will appear here</p>
              </div>
            ) : (
              <>
                {overdueReminders.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-destructive flex items-center gap-1 mb-2">
                      <AlertCircle className="h-4 w-4" />
                      Overdue ({overdueReminders.length})
                    </h4>
                    <div className="space-y-2">
                      {overdueReminders.map((reminder) => (
                        <ReminderCard
                          key={reminder.id}
                          reminder={reminder}
                          onClick={() => handleReminderClick(reminder)}
                          onComplete={() => completeReminder(reminder.id)}
                          onDelete={() => deleteReminder(reminder.id)}
                          isOverdue
                        />
                      ))}
                    </div>
                  </div>
                )}

                {todayReminders.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-2">
                      <Calendar className="h-4 w-4" />
                      Today ({todayReminders.length})
                    </h4>
                    <div className="space-y-2">
                      {todayReminders.map((reminder) => (
                        <ReminderCard
                          key={reminder.id}
                          reminder={reminder}
                          onClick={() => handleReminderClick(reminder)}
                          onComplete={() => completeReminder(reminder.id)}
                          onDelete={() => deleteReminder(reminder.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {upcomingReminders.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-2">
                      <Clock className="h-4 w-4" />
                      Upcoming ({upcomingReminders.length})
                    </h4>
                    <div className="space-y-2">
                      {upcomingReminders.map((reminder) => (
                        <ReminderCard
                          key={reminder.id}
                          reminder={reminder}
                          onClick={() => handleReminderClick(reminder)}
                          onComplete={() => completeReminder(reminder.id)}
                          onDelete={() => deleteReminder(reminder.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-2">
            {completedReminders.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Check className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No completed reminders</p>
              </div>
            ) : (
              completedReminders.slice(0, 20).map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  onClick={() => handleReminderClick(reminder)}
                  onComplete={() => {}}
                  onDelete={() => deleteReminder(reminder.id)}
                  isCompleted
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface ReminderCardProps {
  reminder: Reminder;
  onClick: () => void;
  onComplete: () => void;
  onDelete: () => void;
  isOverdue?: boolean;
  isCompleted?: boolean;
}

function ReminderCard({ reminder, onClick, onComplete, onDelete, isOverdue, isCompleted }: ReminderCardProps) {
  const dueDate = new Date(reminder.due_at);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer group',
        isOverdue && 'border-destructive/50 bg-destructive/5',
        isCompleted && 'opacity-60',
        !isOverdue && !isCompleted && 'hover:bg-muted/50'
      )}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('font-medium', isCompleted && 'line-through')}>
            {reminder.title}
          </span>
          {getPriorityBadge(reminder.priority)}
        </div>
        {reminder.entity_name && (
          <p className="text-sm text-muted-foreground truncate mb-1">
            {reminder.entity_name}
          </p>
        )}
        {reminder.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
            {reminder.description}
          </p>
        )}
        <p className={cn('text-xs', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
          {isCompleted ? (
            `Completed ${reminder.completed_at ? formatDistanceToNow(new Date(reminder.completed_at), { addSuffix: true }) : ''}`
          ) : (
            <>
              Due: {format(dueDate, 'PPp')} ({formatDistanceToNow(dueDate, { addSuffix: true })})
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isCompleted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onComplete();
            }}
          >
            <Check className="h-4 w-4 text-green-500" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

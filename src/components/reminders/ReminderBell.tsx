import { useEffect, useState } from 'react';
import { Bell, Check, Trash2, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useReminders, usePendingRemindersCount, useCompleteReminder, useDeleteReminder, Reminder } from '@/hooks/useReminders';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'text-destructive';
    case 'medium':
      return 'text-amber-500';
    case 'low':
      return 'text-blue-500';
    default:
      return 'text-muted-foreground';
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

export function ReminderBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: reminders = [] } = useReminders();
  const { data: pendingCount = 0 } = usePendingRemindersCount();
  const { mutate: completeReminder } = useCompleteReminder();
  const { mutate: deleteReminder } = useDeleteReminder();

  // Filter to show incomplete reminders, sorted by due date
  const activeReminders = reminders
    .filter(r => !r.is_completed)
    .slice(0, 10);

  const overdueReminders = activeReminders.filter(r => isPast(new Date(r.due_at)));
  const todayReminders = activeReminders.filter(r => !isPast(new Date(r.due_at)) && isToday(new Date(r.due_at)));

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('reminders-bell')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Reminders will be refetched by react-query
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleReminderClick = (reminder: Reminder) => {
    const link = getEntityLink(reminder.entity_type, reminder.entity_id);
    if (link) {
      navigate(link);
    }
  };

  const totalActiveCount = overdueReminders.length + todayReminders.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalActiveCount > 0 && (
            <Badge 
              variant={overdueReminders.length > 0 ? 'destructive' : 'default'}
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalActiveCount > 9 ? '9+' : totalActiveCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Reminders</span>
          {pendingCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {pendingCount} overdue
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {activeReminders.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No active reminders
          </div>
        ) : (
          <>
            {overdueReminders.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Overdue
                </div>
                {overdueReminders.map((reminder) => (
                  <ReminderItem
                    key={reminder.id}
                    reminder={reminder}
                    onClick={() => handleReminderClick(reminder)}
                    onComplete={() => completeReminder(reminder.id)}
                    onDelete={() => deleteReminder(reminder.id)}
                    isOverdue
                  />
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {todayReminders.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Today
                </div>
                {todayReminders.map((reminder) => (
                  <ReminderItem
                    key={reminder.id}
                    reminder={reminder}
                    onClick={() => handleReminderClick(reminder)}
                    onComplete={() => completeReminder(reminder.id)}
                    onDelete={() => deleteReminder(reminder.id)}
                  />
                ))}
              </>
            )}

            {activeReminders.filter(r => !isPast(new Date(r.due_at)) && !isToday(new Date(r.due_at))).length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Upcoming
                </div>
                {activeReminders
                  .filter(r => !isPast(new Date(r.due_at)) && !isToday(new Date(r.due_at)))
                  .slice(0, 5)
                  .map((reminder) => (
                    <ReminderItem
                      key={reminder.id}
                      reminder={reminder}
                      onClick={() => handleReminderClick(reminder)}
                      onComplete={() => completeReminder(reminder.id)}
                      onDelete={() => deleteReminder(reminder.id)}
                    />
                  ))}
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ReminderItemProps {
  reminder: Reminder;
  onClick: () => void;
  onComplete: () => void;
  onDelete: () => void;
  isOverdue?: boolean;
}

function ReminderItem({ reminder, onClick, onComplete, onDelete, isOverdue }: ReminderItemProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer group',
        isOverdue && 'bg-destructive/5'
      )}
      onClick={onClick}
    >
      <div className={cn('shrink-0 mt-0.5', getPriorityColor(reminder.priority))}>
        <Clock className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{reminder.title}</p>
        {reminder.entity_name && (
          <p className="text-xs text-muted-foreground truncate">{reminder.entity_name}</p>
        )}
        <p className={cn('text-xs mt-0.5', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
          {formatDistanceToNow(new Date(reminder.due_at), { addSuffix: true })}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
        >
          <Check className="h-4 w-4 text-green-500" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

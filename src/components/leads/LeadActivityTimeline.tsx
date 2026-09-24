import { formatDistanceToNow } from 'date-fns';
import { 
  Phone, 
  MessageCircle, 
  Mail, 
  StickyNote, 
  RefreshCcw, 
  Calendar, 
  FileText, 
  Clock,
  Repeat
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivities } from '@/hooks/useActivities';
import { cn } from '@/lib/utils';

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  note: StickyNote,
  status_change: RefreshCcw,
  meeting: Calendar,
  quote_sent: FileText,
  follow_up: Clock,
  repeat_enquiry: Repeat,
};

const activityColors: Record<string, string> = {
  call: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  whatsapp: 'bg-green-500/10 text-green-600 border-green-500/20',
  email: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  note: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  status_change: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  meeting: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  quote_sent: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  follow_up: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  repeat_enquiry: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
};

interface LeadActivityTimelineProps {
  leadId: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function LeadActivityTimeline({ leadId }: LeadActivityTimelineProps) {
  const { data: activities, isLoading } = useActivities(leadId);

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-muted/50 mb-4">
          <Clock className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h4 className="text-sm font-medium text-foreground mb-1">No activities yet</h4>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          Start engaging with this lead to see the activity timeline
        </p>
      </div>
    );
  }

  return (
    <div className="relative py-4">
      {/* Timeline line */}
      <div className="absolute left-[18px] top-6 bottom-6 w-px bg-border/60" />
      
      <div className="space-y-4">
        {activities.map((activity, index) => {
          const Icon = activityIcons[activity.activity_type] || StickyNote;
          const colorClass = activityColors[activity.activity_type] || 'bg-muted text-muted-foreground border-border';
          
          return (
            <div 
              key={activity.id} 
              className="relative flex gap-3 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Icon */}
              <div className={cn(
                'relative z-10 flex-shrink-0 h-9 w-9 rounded-full border flex items-center justify-center',
                colorClass
              )}>
                <Icon className="h-4 w-4" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize text-foreground">
                      {activity.activity_type.replace('_', ' ')}
                    </p>
                    {activity.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {activity.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </span>
                </div>
                
                {/* User info */}
                {activity.user && (
                  <div className="flex items-center gap-2 mt-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={activity.user.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px] bg-muted">
                        {getInitials(activity.user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {activity.user.full_name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

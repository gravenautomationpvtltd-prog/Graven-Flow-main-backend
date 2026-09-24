import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  FileText, 
  Send, 
  CheckCircle, 
  Clock,
  User,
  DollarSign,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivities } from '@/hooks/useActivities';

interface AccountabilityTimelineProps {
  leadId: string;
  leadCreatedAt: string;
  firstResponseAt?: string | null;
}

const activityIcons: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  note: <FileText className="h-4 w-4" />,
  quotation: <FileText className="h-4 w-4" />,
  quotation_sent: <Send className="h-4 w-4" />,
  status_change: <ArrowRight className="h-4 w-4" />,
  meeting: <User className="h-4 w-4" />,
  payment: <DollarSign className="h-4 w-4" />,
};

const channelColors: Record<string, string> = {
  call: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
  email: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
  whatsapp: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
};

export function AccountabilityTimeline({ leadId, leadCreatedAt, firstResponseAt }: AccountabilityTimelineProps) {
  const { data: activities, isLoading } = useActivities(leadId);

  const formatResponseTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
  };

  const getResponseTimeColor = (minutes: number) => {
    if (minutes <= 30) return 'text-green-600 dark:text-green-400';
    if (minutes <= 120) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Calculate metrics
  const channelsUsed = new Set<string>();
  let firstActivity: Date | null = null;
  let quotationCount = 0;
  let totalInteractions = 0;

  activities?.forEach((activity) => {
    totalInteractions++;
    const type = activity.activity_type.toLowerCase();
    
    if (['call', 'email', 'whatsapp'].includes(type)) {
      channelsUsed.add(type);
    }
    
    if (type.includes('quotation')) {
      quotationCount++;
    }
    
    const activityDate = new Date(activity.created_at);
    if (!firstActivity || activityDate < firstActivity) {
      firstActivity = activityDate;
    }
  });

  const leadCreatedDate = new Date(leadCreatedAt);
  const responseTimeMinutes = firstActivity 
    ? differenceInMinutes(firstActivity, leadCreatedDate) 
    : null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Accountability Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Accountability Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">First Response</span>
            </div>
            <p className={`text-lg font-semibold ${responseTimeMinutes !== null ? getResponseTimeColor(responseTimeMinutes) : ''}`}>
              {responseTimeMinutes !== null ? formatResponseTime(responseTimeMinutes) : '—'}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Channels Used</span>
            </div>
            <div className="flex items-center justify-center gap-1 mt-1">
              {channelsUsed.size > 0 ? (
                Array.from(channelsUsed).map((channel) => (
                  <Badge key={channel} variant="outline" className={`text-xs ${channelColors[channel] || ''}`}>
                    {channel}
                  </Badge>
                ))
              ) : (
                <span className="text-lg font-semibold">—</span>
              )}
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Quotations</span>
            </div>
            <p className="text-lg font-semibold">{quotationCount}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Interactions</span>
            </div>
            <p className="text-lg font-semibold">{totalInteractions}</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Lead Created */}
          <div className="flex items-start gap-3 pb-6 relative">
            <div className="absolute left-[17px] top-8 bottom-0 w-0.5 bg-border" />
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0 z-10">
              <AlertCircle className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 pt-1">
              <p className="font-medium text-sm">Lead Created</p>
              <p className="text-xs text-muted-foreground">
                {format(leadCreatedDate, 'dd MMM yyyy, hh:mm a')}
              </p>
            </div>
          </div>

          {/* Activities */}
          {activities?.map((activity, index) => {
            const icon = activityIcons[activity.activity_type.toLowerCase()] || <FileText className="h-4 w-4" />;
            const isLast = index === activities.length - 1;
            
            return (
              <div key={activity.id} className="flex items-start gap-3 pb-6 relative">
                {!isLast && <div className="absolute left-[17px] top-8 bottom-0 w-0.5 bg-border" />}
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 z-10">
                  {icon}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm capitalize">
                        {activity.activity_type.replace('_', ' ')}
                      </p>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {activity.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  {activity.user && (
                    <p className="text-xs text-muted-foreground mt-1">
                      by {activity.user.full_name}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {(!activities || activities.length === 0) && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">No activities recorded yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

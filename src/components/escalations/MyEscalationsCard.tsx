import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Clock, TrendingUp, ExternalLink, CheckCircle } from 'lucide-react';
import { useMyEscalations, useMyEscalationStats } from '@/hooks/useMyEscalations';
import { formatDistanceToNow } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type EscalationLevel = Database['public']['Enums']['escalation_level'];

const levelConfig: Record<EscalationLevel, { label: string; color: string; icon: React.ReactNode }> = {
  none: { label: 'None', color: 'bg-muted text-muted-foreground', icon: null },
  alert: { label: 'Alert', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', icon: <Clock className="h-3 w-3" /> },
  manager: { label: 'Manager', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30', icon: <TrendingUp className="h-3 w-3" /> },
  coo: { label: 'COO', color: 'bg-red-500/10 text-red-600 border-red-500/30', icon: <AlertTriangle className="h-3 w-3" /> },
  ceo: { label: 'CEO', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30', icon: <AlertTriangle className="h-3 w-3" /> },
};

export function MyEscalationsCard() {
  const { data: escalations, isLoading } = useMyEscalations();
  const { data: stats } = useMyEscalationStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasEscalations = escalations && escalations.length > 0;

  return (
    <Card className={hasEscalations ? 'border-destructive/30 bg-destructive/5' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${hasEscalations ? 'bg-destructive/10' : 'bg-muted'}`}>
              <AlertTriangle className={`h-5 w-5 ${hasEscalations ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <CardTitle className="text-lg">My Escalations</CardTitle>
              <CardDescription>
                {stats?.pending || 0} active • {stats?.thisMonth || 0} this month
              </CardDescription>
            </div>
          </div>
          <Link to="/escalations">
            <Button variant="ghost" size="sm">
              View All
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {!hasEscalations ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle className="h-10 w-10 text-success mb-2" />
            <p className="text-sm font-medium text-success">No Active Escalations</p>
            <p className="text-xs text-muted-foreground">Great job! Keep up the good work.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {escalations.slice(0, 3).map((escalation) => {
              const config = levelConfig[escalation.escalation_level];
              return (
                <div
                  key={escalation.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={config.color}>
                      <span className="flex items-center gap-1">
                        {config.icon}
                        {config.label}
                      </span>
                    </Badge>
                    <div>
                      {escalation.lead && (
                        <Link
                          to={`/leads/${escalation.lead.id}`}
                          className="text-sm font-medium hover:text-primary hover:underline"
                        >
                          {escalation.lead.title}
                        </Link>
                      )}
                      {escalation.task && (
                        <span className="text-sm font-medium">{escalation.task.title}</span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {escalation.reason || 'No activity'}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(escalation.created_at), { addSuffix: true })}
                  </div>
                </div>
              );
            })}
            {escalations.length > 3 && (
              <Link to="/escalations">
                <Button variant="outline" size="sm" className="w-full">
                  View {escalations.length - 3} more escalations
                </Button>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

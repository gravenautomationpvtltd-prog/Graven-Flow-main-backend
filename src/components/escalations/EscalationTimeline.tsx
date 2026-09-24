import { format } from 'date-fns';
import { AlertTriangle, Clock, TrendingUp, CheckCircle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type EscalationLevel = Database['public']['Enums']['escalation_level'];

interface EscalationTimelineProps {
  escalations: Array<{
    id: string;
    escalation_level: EscalationLevel;
    escalated_from: EscalationLevel | null;
    created_at: string;
    resolved_at: string | null;
    reason: string | null;
    resolution_notes: string | null;
    resolved_by_user?: {
      full_name: string;
    } | null;
  }>;
}

const levelConfig: Record<EscalationLevel, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  none: { label: 'None', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: null },
  alert: { label: 'Alert', color: 'text-yellow-600', bgColor: 'bg-yellow-500/20', icon: <Clock className="h-4 w-4" /> },
  manager: { label: 'Manager Level', color: 'text-orange-600', bgColor: 'bg-orange-500/20', icon: <TrendingUp className="h-4 w-4" /> },
  coo: { label: 'COO Level', color: 'text-red-600', bgColor: 'bg-red-500/20', icon: <AlertTriangle className="h-4 w-4" /> },
  ceo: { label: 'CEO Level', color: 'text-purple-600', bgColor: 'bg-purple-500/20', icon: <AlertTriangle className="h-4 w-4" /> },
};

export function EscalationTimeline({ escalations }: EscalationTimelineProps) {
  if (!escalations || escalations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle className="h-12 w-12 text-success mb-3" />
        <p className="text-sm font-medium">No Escalation History</p>
        <p className="text-xs text-muted-foreground">This item has never been escalated.</p>
      </div>
    );
  }

  // Sort by created_at ascending for timeline view
  const sortedEscalations = [...escalations].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-4">
        {sortedEscalations.map((escalation, index) => {
          const config = levelConfig[escalation.escalation_level];
          const isResolved = !!escalation.resolved_at;

          return (
            <div key={escalation.id} className="relative pl-10">
              {/* Timeline dot */}
              <div
                className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${
                  isResolved ? 'bg-success/20' : config.bgColor
                }`}
              >
                {isResolved ? (
                  <CheckCircle className="h-3 w-3 text-success" />
                ) : (
                  <span className={config.color}>{config.icon}</span>
                )}
              </div>

              {/* Content */}
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${config.color}`}>
                    {isResolved ? 'Resolved' : `Escalated to ${config.label}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(isResolved ? escalation.resolved_at! : escalation.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>

                {escalation.escalated_from && escalation.escalated_from !== 'none' && !isResolved && (
                  <p className="text-xs text-muted-foreground mb-1">
                    From: {levelConfig[escalation.escalated_from].label}
                  </p>
                )}

                {escalation.reason && !isResolved && (
                  <p className="text-xs text-muted-foreground">{escalation.reason}</p>
                )}

                {isResolved && (
                  <div className="text-xs text-muted-foreground">
                    {escalation.resolved_by_user && (
                      <p>By: {escalation.resolved_by_user.full_name}</p>
                    )}
                    {escalation.resolution_notes && (
                      <p className="mt-1 italic">"{escalation.resolution_notes}"</p>
                    )}
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

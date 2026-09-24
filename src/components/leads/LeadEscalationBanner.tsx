import { AlertTriangle, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatDistanceToNow } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type EscalationLevel = Database['public']['Enums']['escalation_level'];

interface LeadEscalationBannerProps {
  level: EscalationLevel | null;
  escalatedAt: string | null;
  lastActivityAt: string | null;
}

const levelConfig: Record<EscalationLevel, { title: string; className: string }> = {
  none: { title: '', className: '' },
  alert: { title: 'Lead Requires Attention', className: 'border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200' },
  manager: { title: 'Escalated to Manager', className: 'border-orange-500 bg-orange-50 text-orange-900 dark:bg-orange-950 dark:text-orange-200' },
  coo: { title: 'Escalated to COO', className: 'border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-200' },
  ceo: { title: 'Escalated to CEO', className: 'border-red-600 bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100' },
};

export function LeadEscalationBanner({ level, escalatedAt, lastActivityAt }: LeadEscalationBannerProps) {
  if (!level || level === 'none') return null;

  const config = levelConfig[level];
  const escalatedTime = escalatedAt 
    ? formatDistanceToNow(new Date(escalatedAt), { addSuffix: true })
    : null;
  const inactiveTime = lastActivityAt
    ? formatDistanceToNow(new Date(lastActivityAt), { addSuffix: true })
    : null;

  return (
    <Alert className={config.className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{config.title}</AlertTitle>
      <AlertDescription className="flex items-center gap-4 mt-1">
        {escalatedTime && (
          <span className="flex items-center gap-1 text-sm">
            <Clock className="h-3 w-3" />
            Escalated {escalatedTime}
          </span>
        )}
        {inactiveTime && (
          <span className="text-sm opacity-75">
            Last activity {inactiveTime}
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}

import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type EscalationLevel = Database['public']['Enums']['escalation_level'];

const escalationConfig: Record<EscalationLevel, { label: string; className: string; show: boolean }> = {
  none: { label: 'None', className: '', show: false },
  alert: { label: 'Alert', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', show: true },
  manager: { label: 'Manager', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', show: true },
  coo: { label: 'COO', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', show: true },
  ceo: { label: 'CEO', className: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300', show: true },
};

interface EscalationBadgeProps {
  level: EscalationLevel;
  className?: string;
}

export function EscalationBadge({ level, className }: EscalationBadgeProps) {
  const config = escalationConfig[level];
  
  if (!config.show) return null;
  
  return (
    <Badge variant="secondary" className={cn(config.className, 'gap-1', className)}>
      <AlertTriangle className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

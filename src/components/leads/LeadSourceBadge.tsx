import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type LeadSource = Database['public']['Enums']['lead_source'];

const sourceConfig: Record<LeadSource, { label: string; className: string }> = {
  indiamart: { label: 'IndiaMart', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  justdial: { label: 'JustDial', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  tradeindia: { label: 'TradeIndia', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  whatsapp: { label: 'WhatsApp', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  email: { label: 'Email', className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400' },
  website: { label: 'Website', className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' },
  referral: { label: 'Referral', className: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400' },
  manual: { label: 'Manual', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
  cro_followup: { label: 'CRO Follow-up', className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' },
};

interface LeadSourceBadgeProps {
  source: LeadSource;
  className?: string;
}

export function LeadSourceBadge({ source, className }: LeadSourceBadgeProps) {
  const config = sourceConfig[source];
  
  return (
    <Badge variant="outline" className={cn(config.className, 'border-0', className)}>
      {config.label}
    </Badge>
  );
}

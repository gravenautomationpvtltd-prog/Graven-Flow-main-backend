import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ShoppingBag, MessageSquare, PhoneCall } from 'lucide-react';

interface LeadTypeBadgeProps {
  type?: string | null;
  className?: string;
}

export function LeadTypeBadge({ type, className }: LeadTypeBadgeProps) {
  if (!type || type === 'unknown') return null;

  if (type === 'buylead') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 text-[11px] font-medium gap-1 px-1.5 py-0',
          className
        )}
      >
        <ShoppingBag className="h-3 w-3" />
        Buy Lead
      </Badge>
    );
  }

  if (type === 'contact') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 text-[11px] font-medium gap-1 px-1.5 py-0',
          className
        )}
      >
        <MessageSquare className="h-3 w-3" />
        Direct Contact
      </Badge>
    );
  }

  if (type === 'call') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 text-[11px] font-medium gap-1 px-1.5 py-0',
          className
        )}
      >
        <PhoneCall className="h-3 w-3" />
        Call
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn('text-[11px] capitalize', className)}>
      {type}
    </Badge>
  );
}

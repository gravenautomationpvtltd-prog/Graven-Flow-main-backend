import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  MousePointer,
  AlertTriangle 
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';

interface EmailStatusBadgeProps {
  status: string;
  deliveredAt?: string | null;
  openedAt?: string | null;
  clickedAt?: string | null;
  bouncedAt?: string | null;
  errorMessage?: string | null;
}

export function EmailStatusBadge({
  status,
  deliveredAt,
  openedAt,
  clickedAt,
  bouncedAt,
  errorMessage,
}: EmailStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'delivered':
        return {
          icon: CheckCircle2,
          label: 'Delivered',
          variant: 'default' as const,
          className: 'bg-green-500/10 text-green-600 border-green-200',
          tooltip: deliveredAt ? `Delivered on ${format(new Date(deliveredAt), 'PPp')}` : 'Email delivered',
        };
      case 'bounced':
        return {
          icon: XCircle,
          label: 'Bounced',
          variant: 'destructive' as const,
          className: 'bg-destructive/10 text-destructive border-destructive/20',
          tooltip: errorMessage || 'Email bounced',
        };
      case 'complained':
        return {
          icon: AlertTriangle,
          label: 'Complained',
          variant: 'destructive' as const,
          className: 'bg-orange-500/10 text-orange-600 border-orange-200',
          tooltip: 'Recipient marked as spam',
        };
      case 'delayed':
        return {
          icon: Clock,
          label: 'Delayed',
          variant: 'secondary' as const,
          className: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
          tooltip: 'Delivery is delayed',
        };
      case 'sent':
      default:
        return {
          icon: Mail,
          label: 'Sent',
          variant: 'secondary' as const,
          className: 'bg-blue-500/10 text-blue-600 border-blue-200',
          tooltip: 'Email sent, awaiting delivery confirmation',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`gap-1 ${config.className}`}>
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
      
      {openedAt && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 bg-purple-500/10 text-purple-600 border-purple-200">
              <Eye className="h-3 w-3" />
              Opened
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Opened on {format(new Date(openedAt), 'PPp')}</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      {clickedAt && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 bg-indigo-500/10 text-indigo-600 border-indigo-200">
              <MousePointer className="h-3 w-3" />
              Clicked
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Clicked on {format(new Date(clickedAt), 'PPp')}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

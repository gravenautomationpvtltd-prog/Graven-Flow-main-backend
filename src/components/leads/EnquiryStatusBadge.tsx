import { Badge } from '@/components/ui/badge';
import { Package, Clock, CheckCircle, AlertCircle, MessageSquare, XCircle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type EnquiryStatus = Database['public']['Enums']['enquiry_status'];

interface EnquiryStatusBadgeProps {
  status: EnquiryStatus | null;
  hasEnquiry: boolean | null;
}

const statusConfig: Record<EnquiryStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; className: string }> = {
  no_enquiry: {
    label: 'No Enquiry',
    variant: 'outline',
    icon: null,
    className: 'text-muted-foreground border-muted',
  },
  pending_prices: {
    label: 'Pending Prices',
    variant: 'default',
    icon: <Clock className="h-3 w-3 mr-1" />,
    className: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  partial_prices: {
    label: 'Partial Prices',
    variant: 'default',
    icon: <AlertCircle className="h-3 w-3 mr-1" />,
    className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30',
  },
  ready_to_quote: {
    label: 'Ready to Quote',
    variant: 'default',
    icon: <Package className="h-3 w-3 mr-1" />,
    className: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
  },
  quoted: {
    label: 'Quoted',
    variant: 'default',
    icon: <MessageSquare className="h-3 w-3 mr-1" />,
    className: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  },
  price_matched: {
    label: 'Price Matched',
    variant: 'default',
    icon: <CheckCircle className="h-3 w-3 mr-1" />,
    className: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
  },
  negotiating: {
    label: 'Negotiating',
    variant: 'default',
    icon: <MessageSquare className="h-3 w-3 mr-1" />,
    className: 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  closed: {
    label: 'Closed',
    variant: 'outline',
    icon: <XCircle className="h-3 w-3 mr-1" />,
    className: 'text-muted-foreground border-muted',
  },
};

export function EnquiryStatusBadge({ status, hasEnquiry }: EnquiryStatusBadgeProps) {
  // If no enquiry, don't show a badge
  if (!hasEnquiry || !status || status === 'no_enquiry') {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={`text-xs flex items-center w-fit ${config.className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

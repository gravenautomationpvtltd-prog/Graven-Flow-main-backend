import { Card, CardContent } from '@/components/ui/card';
import { 
  FileText, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Package, 
  CreditCard,
  Star,
  Calendar,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { SupplierKPIs } from '@/hooks/useSupplierNetworkDetail';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SupplierNetworkStatsCardsProps {
  kpis: SupplierKPIs;
  isLoading?: boolean;
  onCardClick?: (cardKey: string) => void;
}

export function SupplierNetworkStatsCards({ kpis, isLoading, onCardClick }: SupplierNetworkStatsCardsProps) {
  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toFixed(0)}`;
  };

  const formatDays = (days: number) => {
    if (days > 365) return `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m`;
    if (days > 30) return `${Math.floor(days / 30)} months`;
    return `${days} days`;
  };

  const stats = [
    {
      key: 'rfqs',
      label: 'RFQs Received',
      value: kpis.totalRFQsReceived,
      icon: FileText,
      color: 'text-blue-600 bg-blue-100',
      clickable: true,
      tooltip: 'Click to view all RFQs',
    },
    {
      key: 'response-rate',
      label: 'Response Rate',
      value: `${kpis.responseRate.toFixed(0)}%`,
      icon: TrendingUp,
      color: 'text-green-600 bg-green-100',
      subtext: kpis.responseRate >= 80 ? 'Excellent' : kpis.responseRate >= 50 ? 'Good' : 'Needs Improvement',
      clickable: true,
      tooltip: 'Click to view RFQ responses',
    },
    {
      key: 'win-rate',
      label: 'Quote Win Rate',
      value: `${kpis.quoteWinRate.toFixed(0)}%`,
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-100',
      subtext: `${kpis.quotationsSubmitted} quotes submitted`,
      clickable: true,
      tooltip: 'Click to view quotations',
    },
    {
      key: 'lead-time',
      label: 'Avg Lead Time',
      value: `${kpis.avgLeadTime.toFixed(0)} days`,
      icon: Clock,
      color: 'text-orange-600 bg-orange-100',
      clickable: true,
      tooltip: 'Click to view quotation details',
    },
    {
      key: 'business',
      label: 'Total Business',
      value: formatCurrency(kpis.totalBusinessValue),
      icon: DollarSign,
      color: 'text-purple-600 bg-purple-100',
      subtext: `${kpis.totalPOs} POs issued`,
      clickable: true,
      tooltip: 'Click to view payment details',
    },
    {
      key: 'payments',
      label: 'Payments Made',
      value: formatCurrency(kpis.totalPaymentsMade),
      icon: CreditCard,
      color: 'text-indigo-600 bg-indigo-100',
      subtext: `${kpis.totalGRNs} GRNs received`,
      clickable: true,
      tooltip: 'Click to view payment history',
    },
    {
      key: 'pending',
      label: 'Pending Payment',
      value: formatCurrency(kpis.pendingPayment),
      icon: AlertCircle,
      color: kpis.pendingPayment > 0 
        ? kpis.pendingPayment > 100000 
          ? 'text-red-600 bg-red-100' 
          : 'text-amber-600 bg-amber-100'
        : 'text-green-600 bg-green-100',
      subtext: kpis.pendingPayment > 0 ? 'Balance outstanding' : 'All paid',
      clickable: true,
      highlight: kpis.pendingPayment > 0,
      tooltip: 'Click to view pending payments',
    },
    {
      key: 'rating',
      label: 'Avg Rating',
      value: kpis.avgRating > 0 ? kpis.avgRating.toFixed(1) : '-',
      icon: Star,
      color: 'text-yellow-600 bg-yellow-100',
      subtext: kpis.avgRating >= 4 ? 'Top Performer' : kpis.avgRating >= 3 ? 'Good' : 'Average',
      clickable: false,
      tooltip: 'Supplier rating',
    },
    {
      key: 'since',
      label: 'Supplier Since',
      value: formatDays(kpis.supplierSinceDays),
      icon: Calendar,
      color: 'text-teal-600 bg-teal-100',
      clickable: false,
      tooltip: 'Relationship duration',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(9)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-24 mb-2" />
                <div className="h-8 bg-muted rounded w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Tooltip key={stat.key}>
            <TooltipTrigger asChild>
              <Card 
                className={cn(
                  "transition-all duration-200 group relative overflow-hidden",
                  stat.clickable && "cursor-pointer hover:shadow-xl hover:border-primary hover:ring-2 hover:ring-primary/20 hover:scale-[1.02] active:scale-[0.98]",
                  stat.highlight && "ring-2 ring-amber-400/50 animate-pulse-subtle"
                )}
                onClick={() => stat.clickable && onCardClick?.(stat.key)}
              >
                {/* Hover indicator for clickable cards */}
                {stat.clickable && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="h-5 w-5 text-primary" />
                  </div>
                )}
                
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="pr-6">
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1 group-hover:text-primary transition-colors">
                        {stat.value}
                      </p>
                      {stat.subtext && (
                        <p className="text-xs text-muted-foreground mt-1">{stat.subtext}</p>
                      )}
                    </div>
                    <div className={cn(
                      "p-2 rounded-lg transition-transform duration-200 group-hover:scale-110",
                      stat.color
                    )}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>{stat.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

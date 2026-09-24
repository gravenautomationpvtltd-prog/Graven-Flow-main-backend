import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalesExecutiveSummary } from '@/hooks/useActionableReports';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';
import { TrendingUp, Target, Clock, CheckCircle2, IndianRupee } from 'lucide-react';

const fmt = (n: number) => formatCurrencyWithSymbol(n, 'INR');

interface Props {
  dateFrom?: Date;
  dateTo?: Date;
}

export function SalesExecutiveSummary({ dateFrom, dateTo }: Props) {
  const { data, isLoading } = useSalesExecutiveSummary(dateFrom, dateTo);

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      title: 'Active Pipeline',
      value: fmt(data.activePipelineValue),
      subtitle: `${data.activePipelineCount} deals`,
      icon: TrendingUp,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      title: 'Win Rate',
      value: `${data.winRate.toFixed(1)}%`,
      subtitle: 'of decided deals',
      icon: CheckCircle2,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      title: 'Avg Deal Cycle',
      value: `${data.avgDealCycleDays} days`,
      subtitle: 'lead to close',
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      title: 'Price Match Rate',
      value: `${data.priceMatchRate.toFixed(1)}%`,
      subtitle: 'of quotations',
      icon: Target,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/30',
    },
    {
      title: 'Revenue Won',
      value: fmt(data.revenueWon),
      subtitle: `${fmt(data.lostValue)} lost`,
      icon: IndianRupee,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
              <div className={`p-1.5 rounded-md ${card.bg}`}>
                <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
              </div>
            </div>
            <p className="text-xl font-bold tracking-tight">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

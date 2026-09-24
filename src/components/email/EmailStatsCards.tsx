import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, CheckCircle, Eye, MousePointer, XCircle, TrendingUp } from 'lucide-react';
import type { EmailStats } from '@/hooks/useAllEmailLogs';

interface EmailStatsCardsProps {
  stats: EmailStats | undefined;
  isLoading: boolean;
}

export function EmailStatsCards({ stats, isLoading }: EmailStatsCardsProps) {
  const cards = [
    {
      title: 'Total Sent',
      value: stats?.total ?? 0,
      icon: Mail,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Delivered',
      value: stats?.delivered ?? 0,
      subValue: `${stats?.deliveryRate.toFixed(1) ?? 0}%`,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Opened',
      value: stats?.opened ?? 0,
      subValue: `${stats?.openRate.toFixed(1) ?? 0}%`,
      icon: Eye,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Clicked',
      value: stats?.clicked ?? 0,
      subValue: `${stats?.clickRate.toFixed(1) ?? 0}%`,
      icon: MousePointer,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Bounced',
      value: stats?.bounced ?? 0,
      subValue: `${stats?.bounceRate.toFixed(1) ?? 0}%`,
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
                  {card.subValue && (
                    <span className={`text-sm font-medium ${card.color}`}>
                      {card.subValue}
                    </span>
                  )}
                </div>
              </div>
              <div className={`p-3 rounded-full ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

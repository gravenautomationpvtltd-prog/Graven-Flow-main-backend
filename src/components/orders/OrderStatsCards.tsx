import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, IndianRupee, Clock, CheckCircle, TrendingUp, Percent } from 'lucide-react';
import { useOrderStats } from '@/hooks/useOrderAnalytics';

interface OrderStatsCardsProps {
  userId?: string;
  dateRange?: { from: Date | undefined; to: Date | undefined };
}

export function OrderStatsCards({ userId, dateRange }: OrderStatsCardsProps) {
  const { data: stats, isLoading } = useOrderStats(userId, dateRange);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Orders',
      value: stats?.totalOrders || 0,
      subtext: `₹${((stats?.totalValue || 0) / 100000).toFixed(1)}L net sales (excl. GST)`,
      icon: FileText,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Pending Payments',
      value: stats?.pendingPayments || 0,
      subtext: `₹${((stats?.pendingPaymentValue || 0) / 100000).toFixed(1)}L outstanding`,
      icon: IndianRupee,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'In Progress',
      value: stats?.inProgressOrders || 0,
      subtext: 'Orders being fulfilled',
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Fulfilled',
      value: stats?.fulfilledOrders || 0,
      subtext: 'Completed orders',
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{card.subtext}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

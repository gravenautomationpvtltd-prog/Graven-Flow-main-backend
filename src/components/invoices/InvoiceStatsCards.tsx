import { Card, CardContent } from '@/components/ui/card';
import { Receipt, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { useInvoiceStats } from '@/hooks/useInvoices';
import { Skeleton } from '@/components/ui/skeleton';

interface InvoiceStatsCardsProps {
  dateRange?: { from: Date | undefined; to: Date | undefined };
}

export function InvoiceStatsCards({ dateRange }: InvoiceStatsCardsProps) {
  const { data: stats, isLoading } = useInvoiceStats(dateRange);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Invoiced',
      value: `₹${(stats?.totalInvoiced || 0).toLocaleString('en-IN')}`,
      subtitle: `${stats?.totalCount || 0} invoices`,
      icon: Receipt,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Pending Amount',
      value: `₹${(stats?.pendingAmount || 0).toLocaleString('en-IN')}`,
      subtitle: `${stats?.pendingCount || 0} pending`,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Overdue Amount',
      value: `₹${(stats?.overdueAmount || 0).toLocaleString('en-IN')}`,
      subtitle: `${stats?.overdueCount || 0} overdue`,
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      title: 'This Month Collection',
      value: `₹${(stats?.thisMonthCollection || 0).toLocaleString('en-IN')}`,
      subtitle: `${stats?.paidCount || 0} paid`,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
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

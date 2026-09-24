import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Package, IndianRupee, Star, TrendingUp, AlertCircle } from 'lucide-react';
import { useSupplierStats } from '@/hooks/useSupplierDetail';
import { Skeleton } from '@/components/ui/skeleton';

interface SupplierStatsCardsProps {
  supplierId: string;
}

export function SupplierStatsCards({ supplierId }: SupplierStatsCardsProps) {
  const { data: stats, isLoading } = useSupplierStats(supplierId);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      title: 'Total POs',
      value: stats.totalPOs,
      subValue: `₹${stats.totalPOValue.toLocaleString('en-IN')}`,
      icon: FileText,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'GRNs Received',
      value: stats.totalGRNs,
      subValue: 'Goods received',
      icon: Package,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Paid',
      value: `₹${stats.totalPayments.toLocaleString('en-IN')}`,
      subValue: stats.outstandingAmount > 0 
        ? `₹${stats.outstandingAmount.toLocaleString('en-IN')} outstanding` 
        : 'All paid',
      icon: IndianRupee,
      iconColor: stats.outstandingAmount > 0 ? 'text-amber-500' : 'text-green-500',
      bgColor: stats.outstandingAmount > 0 ? 'bg-amber-500/10' : 'bg-green-500/10',
    },
    {
      title: 'Avg Rating',
      value: stats.avgOverall > 0 ? `${stats.avgOverall} / 5` : 'No ratings',
      subValue: stats.totalRatings > 0 ? `${stats.totalRatings} reviews` : 'Not rated yet',
      icon: Star,
      iconColor: stats.avgOverall >= 4 ? 'text-yellow-500' : stats.avgOverall >= 3 ? 'text-orange-500' : 'text-muted-foreground',
      bgColor: stats.avgOverall >= 4 ? 'bg-yellow-500/10' : stats.avgOverall >= 3 ? 'bg-orange-500/10' : 'bg-muted',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.iconColor}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.subValue}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

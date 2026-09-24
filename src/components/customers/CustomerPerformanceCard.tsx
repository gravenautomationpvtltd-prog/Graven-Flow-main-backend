import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, IndianRupee, ShoppingCart, Clock, FileText, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import { useCustomerStats } from '@/hooks/useCustomerStats';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface CustomerPerformanceCardProps {
  customerId: string;
}

export function CustomerPerformanceCard({ customerId }: CustomerPerformanceCardProps) {
  const { data: stats, isLoading } = useCustomerStats(customerId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5" />
          Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IndianRupee className="h-4 w-4" />
              Lifetime Value
            </div>
            <p className="text-xl font-bold">{formatCurrency(stats.lifetimeValue)}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShoppingCart className="h-4 w-4" />
              Total Orders
            </div>
            <p className="text-xl font-bold">{stats.totalOrders}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IndianRupee className="h-4 w-4" />
              Avg Order Value
            </div>
            <p className="text-xl font-bold">{formatCurrency(stats.averageOrderValue)}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Order Frequency
            </div>
            <p className="text-xl font-bold">
              {stats.orderFrequencyDays ? `${stats.orderFrequencyDays} days` : '-'}
            </p>
          </div>
        </div>

        {/* Price Match Funnel */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-medium mb-3">Price Match Funnel</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1 text-center">
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Quotations
              </div>
              <p className="text-lg font-bold">{stats.totalQuotations}</p>
            </div>
            <div className="space-y-1 text-center">
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Price Matched
              </div>
              <p className="text-lg font-bold">{stats.priceMatchedCount}</p>
            </div>
            <div className="space-y-1 text-center">
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Converted
              </div>
              <p className="text-lg font-bold">{stats.convertedCount}</p>
            </div>
          </div>
          {stats.priceMatchedCount > 0 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Match → Conversion: {stats.matchToConversionRate.toFixed(1)}%
            </p>
          )}
        </div>

        <div className="mt-4 pt-4 border-t space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Outstanding Balance</span>
            <Badge variant={stats.outstandingBalance > 0 ? 'destructive' : 'secondary'}>
              {formatCurrency(stats.outstandingBalance)}
            </Badge>
          </div>
          
          {stats.firstOrderDate && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> First Order
              </span>
              <span className="text-sm">{format(new Date(stats.firstOrderDate), 'dd MMM yyyy')}</span>
            </div>
          )}
          
          {stats.lastOrderDate && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Last Order
              </span>
              <span className="text-sm">{format(new Date(stats.lastOrderDate), 'dd MMM yyyy')}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

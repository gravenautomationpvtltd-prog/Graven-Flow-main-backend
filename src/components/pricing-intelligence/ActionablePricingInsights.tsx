import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, TrendingUp, AlertTriangle, Users, Package, IndianRupee } from 'lucide-react';
import { usePriceRelatedLosses, useFavorablePriceProducts, useCustomerPriceSensitivity, usePricingHealthMetrics } from '@/hooks/useActionablePricing';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';

const formatCurrency = (amount: number) => formatCurrencyWithSymbol(amount, 'INR');

export function ActionablePricingInsights() {
  const { data: healthMetrics, isLoading: healthLoading } = usePricingHealthMetrics();
  const { data: priceLosses, isLoading: lossesLoading } = usePriceRelatedLosses(5);
  const { data: favorableProducts, isLoading: favorableLoading } = useFavorablePriceProducts(5);
  const { data: sensitiveCustomers, isLoading: customersLoading } = useCustomerPriceSensitivity(5);

  if (healthLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Health Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthMetrics?.overall_win_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {healthMetrics?.total_won} won of {healthMetrics?.total_quotes_analyzed} quoted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Lost to Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {healthMetrics?.lost_to_price || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {healthMetrics?.price_related_loss_rate.toFixed(0)}% of losses were price-related
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-green-500" />
              Revenue Won
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(healthMetrics?.total_revenue_won || 0)}
            </div>
            <p className="text-xs text-muted-foreground">From won deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Revenue Lost (Price)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(healthMetrics?.total_revenue_lost_to_price || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Lost due to pricing</p>
          </CardContent>
        </Card>
      </div>

      {/* Three Column Insights */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Products Losing to Price */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-red-500" />
              Products Losing Deals
            </CardTitle>
            <CardDescription>Review pricing for these products</CardDescription>
          </CardHeader>
          <CardContent>
            {lossesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : priceLosses?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No price-related losses detected
              </p>
            ) : (
              <div className="space-y-3">
                {priceLosses?.map((product) => (
                  <div key={product.product_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Lost {product.total_times_lost}x • {formatCurrency(product.lost_revenue)}
                      </p>
                    </div>
                    <Badge variant={product.suggested_action === 'review_pricing' ? 'destructive' : 'secondary'} className="ml-2 shrink-0">
                      {product.suggested_action === 'review_pricing' ? 'Review Price' : 'Find Supplier'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Favorable Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              High Win Rate Products
            </CardTitle>
            <CardDescription>Stock more of these winners</CardDescription>
          </CardHeader>
          <CardContent>
            {favorableLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : favorableProducts?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Need more data to identify winners
              </p>
            ) : (
              <div className="space-y-3">
                {favorableProducts?.map((product) => (
                  <div key={product.product_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.win_rate.toFixed(0)}% win rate • {product.times_won} won
                      </p>
                    </div>
                    <Badge variant="default" className="ml-2 shrink-0 bg-green-600">
                      {product.recommendation === 'premium_product' ? 'Premium' : 'Stock More'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Price Sensitive Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              Price-Sensitive Customers
            </CardTitle>
            <CardDescription>Consider special pricing</CardDescription>
          </CardHeader>
          <CardContent>
            {customersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : sensitiveCustomers?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No price-sensitive patterns detected
              </p>
            ) : (
              <div className="space-y-3">
                {sensitiveCustomers?.map((customer) => (
                  <div key={customer.customer_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{customer.company_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {customer.quotes_lost_to_price} of {customer.total_quotes_received} lost to price
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2 shrink-0 border-amber-500 text-amber-600">
                      {customer.recommendation === 'offer_discount' ? 'Offer Discount' : 'Focus Value'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp } from 'lucide-react';
import { useSupplierRatings, useSupplierStats } from '@/hooks/useSupplierDetail';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Progress } from '@/components/ui/progress';

interface SupplierRatingsSectionProps {
  supplierId: string;
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
          }`}
        />
      ))}
    </div>
  );
}

export function SupplierRatingsSection({ supplierId }: SupplierRatingsSectionProps) {
  const { data: ratings, isLoading: loadingRatings } = useSupplierRatings(supplierId);
  const { data: stats, isLoading: loadingStats } = useSupplierStats(supplierId);

  if (loadingRatings || loadingStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Ratings & Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Ratings & Reviews ({ratings?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rating Summary */}
        {stats && stats.totalRatings > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="text-center">
                <div className="text-4xl font-bold">{stats.avgOverall}</div>
                <StarRating rating={Math.round(stats.avgOverall)} size="lg" />
                <div className="text-sm text-muted-foreground mt-1">
                  {stats.totalRatings} reviews
                </div>
              </div>
            </div>
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-sm w-20">Quality</span>
                <Progress value={stats.avgQuality * 20} className="flex-1" />
                <span className="text-sm font-medium w-8">{stats.avgQuality}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm w-20">Delivery</span>
                <Progress value={stats.avgDelivery * 20} className="flex-1" />
                <span className="text-sm font-medium w-8">{stats.avgDelivery}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm w-20">Price</span>
                <Progress value={stats.avgPrice * 20} className="flex-1" />
                <span className="text-sm font-medium w-8">{stats.avgPrice}</span>
              </div>
            </div>
          </div>
        )}

        {/* Individual Reviews */}
        {!ratings || ratings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No ratings yet
          </div>
        ) : (
          <div className="space-y-4">
            {ratings.map((rating) => (
              <div key={rating.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StarRating rating={rating.overall_rating || 0} />
                    <span className="font-medium">{rating.overall_rating}/5</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(rating.rated_at), 'dd MMM yyyy')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  {rating.quality_rating && (
                    <Badge variant="outline">Quality: {rating.quality_rating}/5</Badge>
                  )}
                  {rating.delivery_rating && (
                    <Badge variant="outline">Delivery: {rating.delivery_rating}/5</Badge>
                  )}
                  {rating.price_rating && (
                    <Badge variant="outline">Price: {rating.price_rating}/5</Badge>
                  )}
                </div>
                {rating.comments && (
                  <p className="text-sm text-muted-foreground">{rating.comments}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {(rating.po as any)?.po_number && (
                    <span>PO: {(rating.po as any).po_number}</span>
                  )}
                  {(rating.grn as any)?.grn_number && (
                    <span>GRN: {(rating.grn as any).grn_number}</span>
                  )}
                  {(rating.rated_by_profile as any)?.full_name && (
                    <span>By: {(rating.rated_by_profile as any).full_name}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

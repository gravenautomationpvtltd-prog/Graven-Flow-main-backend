import { Star } from 'lucide-react';
import { useSupplierAverageRating } from '@/hooks/useSupplierRatings';
import { cn } from '@/lib/utils';

interface SupplierRatingBadgeProps {
  supplierId: string;
  showCount?: boolean;
  size?: 'sm' | 'md';
}

export function SupplierRatingBadge({ supplierId, showCount = false, size = 'sm' }: SupplierRatingBadgeProps) {
  const { data: rating, isLoading } = useSupplierAverageRating(supplierId);

  if (isLoading || !rating) {
    return null;
  }

  const starSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex items-center gap-1">
      <Star className={cn(starSize, 'fill-yellow-400 text-yellow-400')} />
      <span className={cn('font-medium', textSize)}>{rating.overall.toFixed(1)}</span>
      {showCount && (
        <span className={cn('text-muted-foreground', textSize)}>
          ({rating.count})
        </span>
      )}
    </div>
  );
}

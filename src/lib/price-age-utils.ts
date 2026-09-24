import { formatDistanceToNow, differenceInDays } from 'date-fns';

export function getPriceAge(priceUpdatedAt: string | null): string {
  if (!priceUpdatedAt) return 'No price history';
  return formatDistanceToNow(new Date(priceUpdatedAt), { addSuffix: true });
}

// Returns semantic color class based on staleness
export function getPriceAgeColor(priceUpdatedAt: string | null): string {
  if (!priceUpdatedAt) return 'text-muted-foreground';
  const daysSinceUpdate = differenceInDays(new Date(), new Date(priceUpdatedAt));
  
  if (daysSinceUpdate <= 7) return 'text-green-600';      // Fresh (≤1 week)
  if (daysSinceUpdate <= 30) return 'text-yellow-600';    // Warning (1-4 weeks)
  return 'text-red-600';                                   // Stale (>1 month)
}

// Returns badge variant based on staleness
export function getPriceAgeBadgeVariant(priceUpdatedAt: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!priceUpdatedAt) return 'secondary';
  const daysSinceUpdate = differenceInDays(new Date(), new Date(priceUpdatedAt));
  
  if (daysSinceUpdate <= 7) return 'default';
  if (daysSinceUpdate <= 30) return 'outline';
  return 'destructive';
}

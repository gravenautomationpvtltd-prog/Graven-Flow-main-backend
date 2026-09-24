import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PercentChangeIndicatorProps {
  value: number | null;
  /** If true, a decrease is good (e.g. "Lost" deals going down) */
  invertColor?: boolean;
  className?: string;
}

export function PercentChangeIndicator({ value, invertColor = false, className }: PercentChangeIndicatorProps) {
  if (value === null) return null;

  const isPositive = value > 0;
  const isZero = Math.abs(value) < 0.5;

  if (isZero) {
    return (
      <div className={cn('flex items-center gap-0.5 text-xs text-muted-foreground', className)}>
        <Minus className="h-3 w-3" />
        <span>0%</span>
      </div>
    );
  }

  const isGood = invertColor ? !isPositive : isPositive;

  return (
    <div className={cn(
      'flex items-center gap-0.5 text-xs font-medium',
      isGood ? 'text-green-600' : 'text-red-500',
      className
    )}>
      {isPositive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      <span>{isPositive ? '+' : ''}{Math.round(value)}%</span>
    </div>
  );
}

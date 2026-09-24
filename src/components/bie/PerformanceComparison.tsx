import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compareToTeam } from '@/lib/bie-performance';

/**
 * Shows how a person's number compares with the team average.
 * `higherIsBetter=false` flips the colour (e.g. turnaround days, rework rate).
 */
export function VersusTeam({
  value,
  average,
  higherIsBetter = true,
}: {
  value: number | null;
  average: number | null;
  higherIsBetter?: boolean;
}) {
  const delta = compareToTeam(value, average);
  if (delta === null) return <span className="text-xs text-muted-foreground">—</span>;

  const flat = Math.abs(delta) < 5;
  const better = higherIsBetter ? delta > 0 : delta < 0;
  const Icon = flat ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        flat ? 'text-muted-foreground' : better ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {flat ? 'on par' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}% vs team`}
    </span>
  );
}

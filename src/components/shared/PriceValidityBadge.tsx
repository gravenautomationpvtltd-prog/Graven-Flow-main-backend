import { Badge } from '@/components/ui/badge';
import { CalendarClock } from 'lucide-react';

const fmt = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

/**
 * Traffic-light badge showing how long a procurement-supplied price stays valid.
 * Green = comfortably valid, amber = expiring within 7 days, red = expired.
 */
export function PriceValidityBadge({
  validUntil,
  className = '',
  showEmpty = false,
}: {
  validUntil?: string | null;
  className?: string;
  showEmpty?: boolean;
}) {
  if (!validUntil) {
    return showEmpty ? (
      <span className={`text-xs text-muted-foreground ${className}`}>No validity given</span>
    ) : null;
  }

  const date = new Date(validUntil);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);

  const tone =
    days < 0
      ? 'bg-destructive/10 text-destructive border-destructive/30'
      : days <= 7
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';

  const label =
    days < 0
      ? `Expired ${fmt(date)}`
      : days === 0
        ? 'Expires today'
        : days <= 7
          ? `Expires in ${days}d · ${fmt(date)}`
          : `Valid till ${fmt(date)}`;

  return (
    <Badge variant="outline" className={`gap-1 text-[11px] ${tone} ${className}`}>
      <CalendarClock className="h-3 w-3" />
      {label}
    </Badge>
  );
}

/** Text form for notes / PDF-ish contexts. */
export function validityNote(validUntil?: string | null): string | null {
  if (!validUntil) return null;
  const d = new Date(validUntil);
  if (Number.isNaN(d.getTime())) return null;
  return `Price valid till ${d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;
}

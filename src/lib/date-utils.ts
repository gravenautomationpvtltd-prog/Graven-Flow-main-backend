import { formatDistanceToNow } from 'date-fns';

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Format a date/time string or Date object in Indian Standard Time (IST, UTC+05:30).
 * Guaranteed to format in IST regardless of the user's OS or browser timezone.
 */
export function formatISTDateTime(
  date: string | Date | number | null | undefined,
  includeSeconds: boolean = false
): string {
  if (!date) return '—';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  }).format(d);
}

/**
 * Format date-only in IST (e.g. "07/10/2026").
 */
export function formatISTDate(
  date: string | Date | number | null | undefined,
  pattern: 'short' | 'medium' = 'short'
): string {
  if (!date) return '—';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  if (pattern === 'medium') {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  }

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Format time-only in IST (e.g. "05:30 PM").
 */
export function formatISTTime(
  date: string | Date | number | null | undefined,
  includeSeconds: boolean = false
): string {
  if (!date) return '—';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  }).format(d);
}

/**
 * Calculates a safe relative time distance to now, guarding against clock drift
 * and future dates so values like "in less than a minute" or negative spans never show.
 */
export function formatISTRelativeTime(
  date: string | Date | number | null | undefined,
  addSuffix: boolean = true
): string {
  if (!date) return '—';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const now = Date.now();
  const diffMs = now - d.getTime();

  // If created within the last 45 seconds or up to 30 seconds in the future (clock skew)
  if (diffMs > -30000 && diffMs < 45000) {
    return 'just now';
  }

  // Safe clamp to now to avoid future distance strings
  const safeDate = diffMs < 0 ? new Date(now) : d;
  return formatDistanceToNow(safeDate, { addSuffix });
}

/**
 * Returns the Date object representing 00:00:00.000 IST of today (UTC aligned).
 */
export function getStartOfTodayIST(): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const istDateString = formatter.format(new Date()); // "YYYY-MM-DD"
  return new Date(`${istDateString}T00:00:00+05:30`);
}

/**
 * Returns the Date object representing 23:59:59.999 IST of today (UTC aligned).
 */
export function getEndOfTodayIST(): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const istDateString = formatter.format(new Date()); // "YYYY-MM-DD"
  return new Date(`${istDateString}T23:59:59.999+05:30`);
}

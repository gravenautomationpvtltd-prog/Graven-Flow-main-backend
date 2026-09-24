import { differenceInMilliseconds } from 'date-fns';
import { DateRangeParam } from '@/hooks/useEmployeeStats';

/**
 * Given a date range, compute the previous period of equal duration.
 * E.g. if current is Jan 1–Jan 31 (31 days), previous is Dec 1–Dec 31.
 */
export function getPreviousPeriod(dateRange: DateRangeParam): DateRangeParam {
  if (!dateRange.from || !dateRange.to) return {};
  const durationMs = differenceInMilliseconds(dateRange.to, dateRange.from);
  const prevTo = new Date(dateRange.from.getTime() - 1); // 1ms before current start
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { from: prevFrom, to: prevTo };
}

/**
 * Calculate percentage change between two values.
 * Returns null if previous is 0 (no meaningful comparison).
 */
export function calcPercentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

import { describe, it, expect } from 'vitest';
import {
  formatISTDateTime,
  formatISTDate,
  formatISTTime,
  formatISTRelativeTime,
  getStartOfTodayIST,
  getEndOfTodayIST,
} from '../date-utils';

describe('date-utils (IST & Timezone Accuracy)', () => {
  it('formats UTC ISO string correctly into IST (+05:30)', () => {
    // 2026-10-07 11:42:00 UTC = 2026-10-07 17:12:00 IST (05:12 PM)
    const utcIso = '2026-10-07T11:42:00.000Z';
    const formatted = formatISTDateTime(utcIso);
    expect(formatted).toContain('07 Oct 2026');
    expect(formatted.toLowerCase()).toContain('5:12 pm');
  });

  it('formats date-only in IST', () => {
    const utcIso = '2026-10-07T11:42:00.000Z';
    const dateShort = formatISTDate(utcIso);
    expect(dateShort).toBe('07/10/2026');

    const dateMedium = formatISTDate(utcIso, 'medium');
    expect(dateMedium).toBe('07 Oct 2026');
  });

  it('formats time-only in IST', () => {
    const utcIso = '2026-10-07T11:42:00.000Z';
    const timeOnly = formatISTTime(utcIso);
    expect(timeOnly.toLowerCase()).toBe('05:12 pm');
  });

  it('handles "just now" for immediate/recent timestamps and clock skew', () => {
    const now = new Date();
    expect(formatISTRelativeTime(now.toISOString())).toBe('just now');

    // 10 seconds ago
    const tenSecsAgo = new Date(Date.now() - 10000);
    expect(formatISTRelativeTime(tenSecsAgo)).toBe('just now');

    // 10 seconds in future (slight clock skew)
    const tenSecsFuture = new Date(Date.now() + 10000);
    expect(formatISTRelativeTime(tenSecsFuture)).toBe('just now');
  });

  it('computes correct relative distance for past times without displaying "in ..."', () => {
    // 10 minutes ago
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const rel = formatISTRelativeTime(tenMinsAgo);
    expect(rel).toContain('minute');
    expect(rel).not.toContain('in ');
  });

  it('returns valid start and end of today in IST', () => {
    const start = getStartOfTodayIST();
    const end = getEndOfTodayIST();

    expect(start.getTime()).toBeLessThan(end.getTime());
    // Difference between end of day and start of day should be ~24 hours
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    expect(Math.round(diffHours)).toBe(24);
  });
});

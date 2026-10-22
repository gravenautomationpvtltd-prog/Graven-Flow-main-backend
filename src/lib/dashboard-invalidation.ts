import { QueryClient } from '@tanstack/react-query';

/**
 * Invalidates all queries related to Dashboard metrics, charts, accounts,
 * receivables, and drilldown dialogs so fresh live data is immediately displayed.
 */
export function invalidateDashboardData(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = String(query.queryKey[0] || '');
      return (
        key === 'leads' ||
        key.startsWith('leads-') ||
        key.startsWith('lqt-') ||
        key.startsWith('dashboard-') ||
        key.startsWith('accounts-') ||
        key.startsWith('payment-') ||
        key.startsWith('receivables-') ||
        key.startsWith('top-outstanding') ||
        key.startsWith('segment-') ||
        key.startsWith('user-quotation') ||
        key.startsWith('quotation') ||
        key === 'quotations' ||
        key === 'spt-inbox' ||
        key.startsWith('spt-') ||
        key.startsWith('recently-resolved') ||
        key.startsWith('duplicate-leads') ||
        key.startsWith('drilldown-')
      );
    },
  });
}

import { useAuth } from '@/hooks/useAuth';

const PROCUREMENT_ONLY_ROLES = ['procurement', 'procurement_manager', 'import_procurement', 'cct'];
const CUSTOMER_VISIBLE_ROLES = ['super_admin', 'coo', 'manager', 'sales', 'cro', 'tst', 'cst', 'accounts'];

/**
 * Procurement staff must not see which customer a price request belongs to.
 * Management and sales-side roles keep full visibility.
 */
export function useIsProcurementOnly(): boolean {
  const { roles } = useAuth();
  return (
    roles.some((r) => PROCUREMENT_ONLY_ROLES.includes(r)) &&
    !roles.some((r) => CUSTOMER_VISIBLE_ROLES.includes(r))
  );
}

export function useCanSeeCustomerName(): boolean {
  return !useIsProcurementOnly();
}

const QUOTE_VISIBLE_ROLES = [
  'procurement',
  'procurement_manager',
  'import_procurement',
  'cct',
  'super_admin',
  'coo',
  'platform_admin',
];

/**
 * Supplier quote comparison is internal to procurement + top management.
 * Sales-side roles must never see how many quotes exist or who gave them.
 */
export function useCanViewSupplierQuotes(): boolean {
  const { roles } = useAuth();
  return roles.some((r) => QUOTE_VISIBLE_ROLES.includes(r));
}

/** Neutral reference shown to procurement instead of the customer name. */
export function requestRef(id: string): string {
  return `REQ-${id.slice(0, 8).toUpperCase()}`;
}

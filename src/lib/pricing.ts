/**
 * Single source of truth for product pricing maths.
 *
 * There is only ONE list price. Two discounts are applied to it:
 *   Sales Price    = List Price x (1 - Sales Discount % / 100)
 *   Purchase Price = List Price x (1 - Purchase Discount % / 100)
 */

export type ProductStatus = 'active' | 'discontinued' | 'obsolete';

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  active: 'Active',
  discontinued: 'Discontinued',
  obsolete: 'Obsolete',
};

/** Fallback minimum gross margin when the tenant has not configured one. */
export const DEFAULT_MIN_MARGIN_PCT = 15;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

export function applyDiscount(listPrice: unknown, discountPct: unknown): number | null {
  const lp = num(listPrice);
  if (lp === null) return null;
  const d = num(discountPct) ?? 0;
  return Math.round(lp * (1 - d / 100) * 100) / 100;
}

export function grossProfit(salesPrice: unknown, purchasePrice: unknown): number | null {
  const s = num(salesPrice);
  if (s === null) return null;
  const p = num(purchasePrice) ?? 0;
  return Math.round((s - p) * 100) / 100;
}

export function grossMarginPct(salesPrice: unknown, purchasePrice: unknown): number | null {
  // Margin is measured on cost: profit ÷ purchase price (markup basis).
  const s = num(salesPrice);
  const p = num(purchasePrice);
  if (s === null || p === null || p <= 0) return null;
  return Math.round(((s - p) / p) * 10000) / 100;
}

export interface PricingInput {
  list_price?: number | null;
  sales_discount_pct?: number | null;
  purchase_discount_pct?: number | null;
  sales_price?: number | null;
  purchase_price?: number | null;
  default_rate?: number | null;
  product_status?: ProductStatus | string | null;
  min_margin_pct?: number | null;
}

export interface PricingResult {
  listPrice: number | null;
  salesDiscountPct: number | null;
  purchaseDiscountPct: number | null;
  salesPrice: number | null;
  purchasePrice: number | null;
  grossProfit: number | null;
  grossMarginPct: number | null;
  status: ProductStatus;
}

/** Derives the full pricing picture for a product row. */
export function computePricing(p: PricingInput): PricingResult {
  const listPrice = num(p.list_price);
  const salesDiscountPct = num(p.sales_discount_pct);
  const purchaseDiscountPct = num(p.purchase_discount_pct);

  const salesPrice =
    num(p.sales_price) ??
    (listPrice !== null && salesDiscountPct !== null ? applyDiscount(listPrice, salesDiscountPct) : null) ??
    num(p.default_rate);

  const purchasePrice =
    num(p.purchase_price) ??
    (listPrice !== null && purchaseDiscountPct !== null ? applyDiscount(listPrice, purchaseDiscountPct) : null);

  const status = (p.product_status as ProductStatus) || 'active';

  return {
    listPrice,
    salesDiscountPct,
    purchaseDiscountPct,
    salesPrice,
    purchasePrice,
    grossProfit: grossProfit(salesPrice, purchasePrice),
    grossMarginPct: grossMarginPct(salesPrice, purchasePrice),
    status: (['active', 'discontinued', 'obsolete'] as const).includes(status) ? status : 'active',
  };
}

export type QuoteEligibility = 'auto' | 'approval' | 'on_request';

export interface EligibilityResult {
  mode: QuoteEligibility;
  label: string;
  description: string;
}

/** Auto-quote decision, derived purely from status + available pricing. */
export function quoteEligibility(p: PricingInput): EligibilityResult {
  const { status, listPrice, salesPrice } = computePricing(p);

  if (!salesPrice || salesPrice <= 0) {
    return {
      mode: 'on_request',
      label: 'Price on request',
      description: 'No usable selling price is available for this product.',
    };
  }

  if (status === 'active' && listPrice && listPrice > 0) {
    return { mode: 'auto', label: 'Auto quote', description: 'Active product with a valid list price.' };
  }

  return {
    mode: 'approval',
    label: 'Manual / approval quote',
    description:
      status === 'active'
        ? 'Selling price available without a current list price — needs review.'
        : `${PRODUCT_STATUS_LABEL[status]} product — needs approval before quoting.`,
  };
}

export interface MarginCheck {
  marginPct: number | null;
  minPct: number;
  belowMinimum: boolean;
}

export function checkMargin(
  salesPrice: unknown,
  purchasePrice: unknown,
  minPct: number | null | undefined = DEFAULT_MIN_MARGIN_PCT,
): MarginCheck {
  const marginPct = grossMarginPct(salesPrice, purchasePrice);
  const threshold = num(minPct) ?? DEFAULT_MIN_MARGIN_PCT;
  return {
    marginPct,
    minPct: threshold,
    belowMinimum: marginPct !== null && marginPct < threshold,
  };
}

export function formatINR(amount: number | null | undefined, fractionDigits = 0): string {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(amount));
}

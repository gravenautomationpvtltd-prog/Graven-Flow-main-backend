// Ready stock = physically available in a warehouse, dispatchable immediately.
// Such items carry a fixed premium over the catalogue selling price.
export const READY_STOCK_PREMIUM_PCT = 5;

/** Apply the ready-stock premium to a base selling price (INR, rounded). */
export function applyReadyStockPremium(base: number | null | undefined): number | null {
  if (base === null || base === undefined || Number.isNaN(Number(base))) return null;
  return Math.round(Number(base) * (1 + READY_STOCK_PREMIUM_PCT / 100));
}

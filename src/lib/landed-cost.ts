// Per-line RMB → USD → INR landed cost calculator.
// Chain (all mid-steps in USD):
//   USD_base = RMB / RMB→USD rate
//   Freight  = CEILING(weight_kg, 1) × freight_usd_per_kg
//   v1 = USD_base + Freight
//   v2 = v1 × (1 + Insurance%)
//   v3 = v2 × (1 + CC%)          (Currency Conversion)
//   v4 = v3 × (1 + Duty%)
//   v5 = v4 × (1 + Expense%)
//   v6 = v5 × (1 + Margin%)
//   v7 = v6 × (1 + Negotiation%)
//   Final INR/unit = v7 × USD→INR rate
//   Line total     = Final INR/unit × qty

export interface CalcInputs {
  rmb_price: number;
  rmb_usd_rate: number;   // e.g. 6.79
  usd_inr_rate: number;   // e.g. 96
  weight_kg: number | null;
  freight_usd_per_kg: number;
  insurance_pct: number;
  cc_pct: number;
  duty_pct: number;
  expense_pct: number;
  margin_pct: number;
  negotiation_pct: number;
  qty: number;
}

export interface CalcResult {
  usd_base: number;
  freight_usd: number;
  v1: number; v2: number; v3: number; v4: number; v5: number; v6: number; v7: number;
  final_inr_per_unit: number;
  final_inr_total: number;
}

const r = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const num = (x: any, fb = 0) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : fb;
};

export function computeLandedCost(i: CalcInputs): CalcResult {
  const rmb = num(i.rmb_price);
  const fxRmbUsd = num(i.rmb_usd_rate, 6.79) || 6.79;
  const fxUsdInr = num(i.usd_inr_rate, 96) || 96;
  const wt = Math.max(0, num(i.weight_kg, 0));
  const perKg = num(i.freight_usd_per_kg, 6);
  const qty = num(i.qty, 1) || 1;

  const usd_base = rmb / fxRmbUsd;
  const freight_usd = Math.ceil(wt) * perKg;
  const v1 = usd_base + freight_usd;
  const v2 = v1 * (1 + num(i.insurance_pct) / 100);
  const v3 = v2 * (1 + num(i.cc_pct) / 100);
  const v4 = v3 * (1 + num(i.duty_pct) / 100);
  const v5 = v4 * (1 + num(i.expense_pct) / 100);
  const v6 = v5 * (1 + num(i.margin_pct) / 100);
  const v7 = v6 * (1 + num(i.negotiation_pct) / 100);

  const final_inr_per_unit = v7 * fxUsdInr;
  const final_inr_total = final_inr_per_unit * qty;

  return {
    usd_base: r(usd_base),
    freight_usd: r(freight_usd),
    v1: r(v1), v2: r(v2), v3: r(v3), v4: r(v4),
    v5: r(v5), v6: r(v6), v7: r(v7),
    final_inr_per_unit: r(final_inr_per_unit),
    final_inr_total: r(final_inr_total),
  };
}

export const DEFAULTS = {
  rmb_usd_rate: 6.79,
  usd_inr_rate: 96,
  freight_usd_per_kg: 6,
  insurance_pct: 2,
  cc_pct: 3,
  duty_pct: 7.5,
  expense_pct: 12,
  margin_pct: 10,
  negotiation_pct: 1,
  qty: 1,
};

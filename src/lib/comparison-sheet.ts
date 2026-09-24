import { computeLandedCost, DEFAULTS } from '@/lib/landed-cost';

export interface ComparisonAssumptions {
  rmb_usd_rate: number;
  usd_inr_rate: number;
  freight_usd_per_kg: number;
  insurance_pct: number;
  cc_pct: number;
  duty_pct: number;
  expense_pct: number;
  margin_pct: number;
  negotiation_pct: number;
}

export const DEFAULT_ASSUMPTIONS: ComparisonAssumptions = {
  rmb_usd_rate: DEFAULTS.rmb_usd_rate,
  usd_inr_rate: DEFAULTS.usd_inr_rate,
  freight_usd_per_kg: DEFAULTS.freight_usd_per_kg,
  insurance_pct: DEFAULTS.insurance_pct,
  cc_pct: DEFAULTS.cc_pct,
  duty_pct: DEFAULTS.duty_pct,
  expense_pct: DEFAULTS.expense_pct,
  margin_pct: DEFAULTS.margin_pct,
  negotiation_pct: DEFAULTS.negotiation_pct,
};

/** A bulk-price (RMB) reference row matched to a quotation line. */
export interface RmbReference {
  rmb_price: number | null;
  weight_kg: number | null;
  final_inr_unit: number | null;
  rmb_usd_rate: number | null;
  usd_inr_rate: number | null;
  freight_usd_per_kg: number | null;
  insurance_pct: number | null;
  cc_pct: number | null;
  duty_pct: number | null;
  expense_pct: number | null;
  margin_pct: number | null;
  negotiation_pct: number | null;
}

export interface ComparisonInputRow {
  model_number: string | null;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  /** Line discount applied on the quotation (invoice logic). */
  discount_percent?: number | null;
  discount_amount?: number | null;
  /** GST / tax percent applied on the quotation line. */
  tax_percent?: number | null;
  list_price: number | null;
  list_price_source: string | null;
  min_margin_pct: number | null;
  rmb?: RmbReference | null;
}

/** Per-unit INR landed-cost components, mirroring the import costing chain. */
export interface LandedBreakdown {
  fob_inr: number;
  freight_inr: number;
  insurance_inr: number;
  cc_inr: number;
  duty_inr: number;
  expense_inr: number;
  /** True cost per unit (FOB + freight + insurance + CC + duty + expense). */
  landed_cost_inr: number;
  /** Reference selling price after standard margin + negotiation uplift. */
  suggested_price_inr: number;
}

export interface ComparisonRow {
  /** Index of the source line, used to key per-line overrides. */
  index: number;
  /** Weight used for freight (per unit), after any per-line override. */
  weight_kg: number;
  /** Effective assumptions used for this line (global + per-line overrides). */
  assumptions: ComparisonAssumptions;
  /** True when this line's components were tuned individually. */
  has_line_override: boolean;
  model_number: string;
  description: string;
  quantity: number;
  unit: string;
  list_price: number | null;
  discount_off_list_pct: number | null;
  rmb_price: number | null;
  /** Full landed cost (all duties/freight/expenses) per unit — cost, no margin. */
  landed_inr_per_unit: number | null;
  breakdown: LandedBreakdown | null;
  /** Reference selling price from the costing chain (cost + margin + negotiation). */
  suggested_price_inr: number | null;
  quoted_rate: number;
  /** Rate after line discount — the figure the invoice actually bills. */
  net_rate: number;
  discount_percent: number;
  tax_percent: number;
  tax_amount: number;
  margin_inr: number | null;
  margin_pct: number | null;
  below_min_margin: boolean;
  /** Taxable line value (net of discount). */
  line_total: number;
  /** Line value including tax — matches the quotation/invoice grand total. */
  line_total_with_tax: number;
  source: 'Bulk price approval' | 'List price' | 'Manual';
}

export interface ComparisonTotals {
  listValue: number;
  landedValue: number;
  freightValue: number;
  dutyValue: number;
  expenseValue: number;
  quotedValue: number;
  taxValue: number;
  quotedValueWithTax: number;
  marginValue: number;
  blendedMarginPct: number | null;
  missingRmbCount: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const numOr = (v: unknown, fb: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

/**
 * Expands the RMB → INR costing chain into its components so the sheet can show
 * freight, duty, CC and expense separately, and so margin is measured against
 * the true landed cost (excluding the margin/negotiation uplift).
 */
function buildBreakdown(rmbPrice: number, a: ComparisonAssumptions, weightKg: number): LandedBreakdown {
  const fx = a.usd_inr_rate || 1;
  const usdBase = rmbPrice / (a.rmb_usd_rate || 1);
  const freightUsd = Math.ceil(Math.max(0, weightKg)) * a.freight_usd_per_kg;

  const v1 = usdBase + freightUsd;
  const insurance = v1 * (a.insurance_pct / 100);
  const v2 = v1 + insurance;
  const cc = v2 * (a.cc_pct / 100);
  const v3 = v2 + cc;
  const duty = v3 * (a.duty_pct / 100);
  const v4 = v3 + duty;
  const expense = v4 * (a.expense_pct / 100);
  const v5 = v4 + expense;
  const v6 = v5 * (1 + a.margin_pct / 100);
  const v7 = v6 * (1 + a.negotiation_pct / 100);

  return {
    fob_inr: r2(usdBase * fx),
    freight_inr: r2(freightUsd * fx),
    insurance_inr: r2(insurance * fx),
    cc_inr: r2(cc * fx),
    duty_inr: r2(duty * fx),
    expense_inr: r2(expense * fx),
    landed_cost_inr: r2(v5 * fx),
    suggested_price_inr: r2(v7 * fx),
  };
}

/** Per-line editable overrides (cost components + inputs) in what-if mode. */
export type LineOverride = Partial<ComparisonAssumptions> & {
  rmb_price?: number | null;
  weight_kg?: number | null;
};

/**
 * Builds the comparison rows. When `overrides` is supplied, landed cost is
 * recomputed live from the RMB price with those assumptions (what-if mode);
 * otherwise the assumptions stored on the approved bulk-price row are used.
 * `lineOverrides` (keyed by row index) wins over both, so a single line's
 * freight/duty/expense/RMB/weight can be tuned independently.
 */
export function buildComparisonRows(
  inputs: ComparisonInputRow[],
  overrides?: ComparisonAssumptions | null,
  lineOverrides?: Record<number, LineOverride> | null,
): { rows: ComparisonRow[]; totals: ComparisonTotals } {
  const rows: ComparisonRow[] = inputs.map((i, idx) => {

    const qty = Number(i.quantity) || 0;
    const rate = Number(i.rate) || 0;
    const listPrice = i.list_price != null && i.list_price > 0 ? Number(i.list_price) : null;
    const lo = lineOverrides?.[idx] || null;
    const baseRmb = i.rmb?.rmb_price != null && i.rmb.rmb_price > 0 ? Number(i.rmb.rmb_price) : null;
    const overriddenRmb = lo?.rmb_price != null && Number(lo.rmb_price) > 0 ? Number(lo.rmb_price) : null;
    const rmbPrice = overriddenRmb ?? baseRmb;

    // Invoice logic: discount first, then tax on the discounted value.
    const discountPct = numOr(i.discount_percent, 0);
    const grossLine = rate * qty;
    const discountAmount =
      i.discount_amount != null && Number(i.discount_amount) > 0
        ? Number(i.discount_amount)
        : r2(grossLine * (discountPct / 100));
    const storedAmount = Number(i.amount);
    const taxableLine = r2(
      Math.max(0, Number.isFinite(storedAmount) && storedAmount > 0 ? storedAmount : grossLine - discountAmount),
    );
    const netRate = qty > 0 ? r2(taxableLine / qty) : r2(rate);
    const taxPct = numOr(i.tax_percent, 0);
    const taxAmount = r2(taxableLine * (taxPct / 100));

    const baseAssumptions: ComparisonAssumptions =
      overrides ?? {
        rmb_usd_rate: numOr(i.rmb?.rmb_usd_rate, DEFAULT_ASSUMPTIONS.rmb_usd_rate),
        usd_inr_rate: numOr(i.rmb?.usd_inr_rate, DEFAULT_ASSUMPTIONS.usd_inr_rate),
        freight_usd_per_kg: numOr(i.rmb?.freight_usd_per_kg, DEFAULT_ASSUMPTIONS.freight_usd_per_kg),
        insurance_pct: numOr(i.rmb?.insurance_pct, DEFAULT_ASSUMPTIONS.insurance_pct),
        cc_pct: numOr(i.rmb?.cc_pct, DEFAULT_ASSUMPTIONS.cc_pct),
        duty_pct: numOr(i.rmb?.duty_pct, DEFAULT_ASSUMPTIONS.duty_pct),
        expense_pct: numOr(i.rmb?.expense_pct, DEFAULT_ASSUMPTIONS.expense_pct),
        margin_pct: numOr(i.rmb?.margin_pct, DEFAULT_ASSUMPTIONS.margin_pct),
        negotiation_pct: numOr(i.rmb?.negotiation_pct, DEFAULT_ASSUMPTIONS.negotiation_pct),
      };

    const assumptions: ComparisonAssumptions = { ...baseAssumptions };
    let hasLineOverride = overriddenRmb != null;
    if (lo) {
      (Object.keys(baseAssumptions) as (keyof ComparisonAssumptions)[]).forEach((k) => {
        const v = lo[k];
        if (v != null && Number.isFinite(Number(v))) {
          assumptions[k] = Number(v);
          hasLineOverride = true;
        }
      });
    }

    const baseWeight = numOr(i.rmb?.weight_kg, 0);
    const weightKg =
      lo?.weight_kg != null && Number.isFinite(Number(lo.weight_kg)) ? Number(lo.weight_kg) : baseWeight;
    if (lo?.weight_kg != null && Number(lo.weight_kg) !== baseWeight) hasLineOverride = true;

    let breakdown: LandedBreakdown | null = null;
    if (rmbPrice != null) {
      breakdown = buildBreakdown(rmbPrice, assumptions, weightKg);
      // Keep the reference selling price aligned with the approved stored figure
      // when we are not in what-if mode.
      if (!overrides && !hasLineOverride && i.rmb?.final_inr_unit != null && Number(i.rmb.final_inr_unit) > 0) {
        breakdown.suggested_price_inr = r2(Number(i.rmb.final_inr_unit));
      }
    }

    const landed = breakdown?.landed_cost_inr ?? null;


    // Cost basis for margin: true landed cost when available, else list-price
    // based net cost using the product's minimum margin (e.g. 60% off list).
    let costBasis: number | null = landed;
    if (costBasis == null && listPrice != null && i.min_margin_pct != null && i.min_margin_pct > 0) {
      costBasis = r2(listPrice * (1 - Number(i.min_margin_pct) / 100));
    }

    const marginInr = costBasis != null ? r2(netRate - costBasis) : null;
    // Margin on cost: profit ÷ purchase/landed cost.
    const marginPct = costBasis != null && costBasis > 0 ? r2(((netRate - costBasis) / costBasis) * 100) : null;

    const discountOffList =
      listPrice != null && listPrice > 0 ? r2(((listPrice - netRate) / listPrice) * 100) : null;

    const belowMin =
      i.min_margin_pct != null && i.min_margin_pct > 0 && marginPct != null
        ? marginPct < Number(i.min_margin_pct)
        : marginPct != null && marginPct < 0;

    const source: ComparisonRow['source'] =
      rmbPrice != null ? 'Bulk price approval' : listPrice != null ? 'List price' : 'Manual';

    return {
      index: idx,
      weight_kg: weightKg,
      assumptions,
      has_line_override: hasLineOverride,
      model_number: i.model_number || '',
      description: i.description || '',
      quantity: qty,
      unit: i.unit || 'Nos',
      list_price: listPrice,
      discount_off_list_pct: discountOffList,
      rmb_price: rmbPrice,
      landed_inr_per_unit: landed,
      breakdown,
      suggested_price_inr: breakdown?.suggested_price_inr ?? null,
      quoted_rate: r2(rate),
      net_rate: netRate,
      discount_percent: r2(discountPct),
      tax_percent: r2(taxPct),
      tax_amount: taxAmount,
      margin_inr: marginInr,
      margin_pct: marginPct,
      below_min_margin: belowMin,
      line_total: taxableLine,
      line_total_with_tax: r2(taxableLine + taxAmount),
      source,
    };
  });

  const sum = (fn: (r: ComparisonRow) => number) => rows.reduce((s, r) => s + fn(r), 0);

  const listValue = sum((r) => (r.list_price ?? 0) * r.quantity);
  const landedValue = sum((r) => (r.landed_inr_per_unit ?? 0) * r.quantity);
  const freightValue = sum((r) => ((r.breakdown?.freight_inr ?? 0) + (r.breakdown?.insurance_inr ?? 0)) * r.quantity);
  const dutyValue = sum((r) => ((r.breakdown?.duty_inr ?? 0) + (r.breakdown?.cc_inr ?? 0)) * r.quantity);
  const expenseValue = sum((r) => (r.breakdown?.expense_inr ?? 0) * r.quantity);
  const quotedValue = sum((r) => r.line_total);
  const taxValue = sum((r) => r.tax_amount);
  const marginValue = sum((r) => (r.margin_inr ?? 0) * r.quantity);
  const comparableQuoted = rows
    .filter((r) => r.landed_inr_per_unit != null)
    .reduce((s, r) => s + r.net_rate * r.quantity, 0);
  const blendedMarginPct =
    landedValue > 0 ? r2(((comparableQuoted - landedValue) / landedValue) * 100) : null;

  return {
    rows,
    totals: {
      listValue: r2(listValue),
      landedValue: r2(landedValue),
      freightValue: r2(freightValue),
      dutyValue: r2(dutyValue),
      expenseValue: r2(expenseValue),
      quotedValue: r2(quotedValue),
      taxValue: r2(taxValue),
      quotedValueWithTax: r2(quotedValue + taxValue),
      marginValue: r2(marginValue),
      blendedMarginPct,
      missingRmbCount: rows.filter((r) => r.rmb_price == null).length,
    },
  };
}

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function comparisonRowsToCSV(
  rows: ComparisonRow[],
  totals: ComparisonTotals,
  meta: { quotationNumber: string; customer?: string | null; assumptions?: ComparisonAssumptions | null },
): string {
  const lines: string[] = [];
  lines.push(`INTERNAL - CONFIDENTIAL - NOT FOR CUSTOMER`);
  lines.push(`Quotation,${csvCell(meta.quotationNumber)}`);
  if (meta.customer) lines.push(`Customer,${csvCell(meta.customer)}`);
  if (meta.assumptions) {
    const a = meta.assumptions;
    lines.push(
      `Assumptions,RMB→USD ${a.rmb_usd_rate},USD→INR ${a.usd_inr_rate},Freight $/kg ${a.freight_usd_per_kg},Insurance ${a.insurance_pct}%,CC ${a.cc_pct}%,Duty ${a.duty_pct}%,Expense ${a.expense_pct}%,Margin ${a.margin_pct}%,Negotiation ${a.negotiation_pct}%`,
    );
  }
  lines.push('');
  lines.push(
    [
      'Model Number',
      'Description',
      'Qty',
      'Unit',
      'List Price (INR)',
      'Disc off List %',
      'RMB Price',
      'FOB INR/unit',
      'Freight+Ins INR/unit',
      'Duty+CC INR/unit',
      'Expense INR/unit',
      'Landed Cost INR/unit',
      'Reference Sell INR/unit',
      'Quoted Rate (INR)',
      'Line Disc %',
      'Net Rate (INR)',
      'Margin (INR)',
      'Margin %',
      'Taxable Value (INR)',
      'Tax %',
      'Tax Amount (INR)',
      'Line Total incl. Tax (INR)',
      'Source',
    ].join(','),
  );
  for (const r of rows) {
    lines.push(
      [
        r.model_number,
        r.description,
        r.quantity,
        r.unit,
        r.list_price ?? '',
        r.discount_off_list_pct ?? '',
        r.rmb_price ?? '',
        r.breakdown?.fob_inr ?? '',
        r.breakdown ? r2(r.breakdown.freight_inr + r.breakdown.insurance_inr) : '',
        r.breakdown ? r2(r.breakdown.duty_inr + r.breakdown.cc_inr) : '',
        r.breakdown?.expense_inr ?? '',
        r.landed_inr_per_unit ?? '',
        r.suggested_price_inr ?? '',
        r.quoted_rate,
        r.discount_percent,
        r.net_rate,
        r.margin_inr ?? '',
        r.margin_pct ?? '',
        r.line_total,
        r.tax_percent,
        r.tax_amount,
        r.line_total_with_tax,
        r.source,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  lines.push('');
  lines.push(`Total list value,${totals.listValue}`);
  lines.push(`Total freight + insurance,${totals.freightValue}`);
  lines.push(`Total duty + CC,${totals.dutyValue}`);
  lines.push(`Total expenses,${totals.expenseValue}`);
  lines.push(`Total landed cost,${totals.landedValue}`);
  lines.push(`Total quoted (taxable),${totals.quotedValue}`);
  lines.push(`Total tax,${totals.taxValue}`);
  lines.push(`Total quoted incl. tax,${totals.quotedValueWithTax}`);
  lines.push(`Total margin,${totals.marginValue}`);
  lines.push(`Blended margin %,${totals.blendedMarginPct ?? ''}`);
  if (totals.missingRmbCount > 0) {
    lines.push(`Note,${csvCell(`${totals.missingRmbCount} line(s) have no RMB reference`)}`);
  }
  return lines.join('\n');
}

// Re-exported so callers can compute a single line's chain if needed.
export { computeLandedCost };

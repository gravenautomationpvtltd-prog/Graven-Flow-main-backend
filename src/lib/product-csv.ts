/**
 * CSV parsing + validation for the two product imports.
 *
 * Active products:      Sr No, Brand, Model No, Description, List Price, Sales Discount %, Purchase Discount %
 * Discontinued/Obsolete: Sr No, Brand, Model No, Description, Status, Sales Price, Purchase Price
 */

import { applyDiscount, grossMarginPct, grossProfit, type ProductStatus } from '@/lib/pricing';

export type ImportType = 'active' | 'legacy';

export interface ActiveImportRow {
  line_no: number;
  sr_no: string;
  brand: string;
  model_no: string;
  description: string;
  list_price: number | null;
  sales_discount_pct: number | null;
  purchase_discount_pct: number | null;
  product_status: ProductStatus;
  sales_price: number | null;
  purchase_price: number | null;
  gross_profit: number | null;
  gross_margin_pct: number | null;
  /** Always KG */
  weight_kg: number | null;
  /** Always CM */
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  error?: string;
}

export interface ValidationResult {
  rows: ActiveImportRow[];
  validRows: ActiveImportRow[];
  errorRows: ActiveImportRow[];
}

/* ------------------------------------------------------------------ parsing */

/** RFC-4180-ish CSV splitter that tolerates quotes, commas and tabs. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(clean);
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === delimiter) { row.push(field); field = ''; continue; }
    if (c === '\n') {
      row.push(field);
      out.push(row);
      row = [];
      field = '';
      continue;
    }
    if (c === '\r') continue;
    field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim() !== ''));
}

function detectDelimiter(text: string): string {
  const head = text.slice(0, 5000);
  const tabs = (head.match(/\t/g) || []).length;
  const commas = (head.match(/,/g) || []).length;
  const semis = (head.match(/;/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const HEADER_ALIASES: Record<string, string[]> = {
  sr_no: ['srno', 'sr', 'serialno', 'sno', 'slno', '#'],
  brand: ['brand', 'make', 'manufacturer'],
  model_no: ['modelno', 'model', 'modelnumber', 'partno', 'partnumber', 'articleno', 'ordercode'],
  description: ['description', 'desc', 'productdescription', 'itemdescription', 'productname'],
  list_price: ['listprice', 'mrp', 'price', 'listpricers', 'listpriceinr'],
  sales_discount_pct: ['salesdiscount', 'salesdiscountpct', 'salesdisc', 'sellingdiscount', 'salesdiscount%'],
  purchase_discount_pct: ['purchasediscount', 'purchasediscountpct', 'purchasedisc', 'buyingdiscount'],
  status: ['status', 'productstatus'],
  sales_price: ['salesprice', 'sellingprice', 'sellprice'],
  purchase_price: ['purchaseprice', 'buyingprice', 'costprice', 'cost'],
  weight_kg: ['weight', 'weightkg', 'weightinkg', 'unitweight', 'unitweightkg', 'netweight'],
  dimensions: ['dimensions', 'dimensionscm', 'dimensionslwhcm', 'dimension', 'size', 'sizecm', 'dimensionslwh'],
};

/** Parses "20 x 15 x 8" / "20×15×8" / "20*15*8" into centimetres. */
export function parseDimensions(raw: string | undefined): {
  length: number | null;
  width: number | null;
  height: number | null;
  invalid: boolean;
} {
  const s = (raw ?? '').trim();
  if (!s) return { length: null, width: null, height: null, invalid: false };
  const parts = s
    .replace(/cm/gi, '')
    .split(/[x×*\/,]/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (parts.length !== 3) return { length: null, width: null, height: null, invalid: true };
  const nums = parts.map((p) => Number(p.replace(/[^\d.]/g, '')));
  if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return { length: null, width: null, height: null, invalid: true };
  return { length: nums[0], width: nums[1], height: nums[2], invalid: false };
}

export function formatDimensions(l: unknown, w: unknown, h: unknown): string {
  const vals = [l, w, h].map((v) => (v === null || v === undefined || v === '' ? null : Number(v)));
  if (vals.some((v) => v === null || !Number.isFinite(v as number))) return '—';
  return `${vals[0]} × ${vals[1]} × ${vals[2]} CM`;
}

function mapHeaders(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[key] !== undefined) continue;
      if (aliases.some((a) => norm(a) === n)) map[key] = i;
    }
  });
  return map;
}

function looksLikeHeader(row: string[]): boolean {
  const joined = row.map(norm).join('|');
  return /brand|model|description/.test(joined) && !/^\d+$/.test(norm(row[0] || ''));
}

function toNumber(raw: string | undefined): { value: number | null; invalid: boolean } {
  const s = (raw ?? '').trim();
  if (!s) return { value: null, invalid: false };
  const cleaned = s.replace(/[₹$€,\s%]/g, '');
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return { value: null, invalid: true };
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? { value: n, invalid: false } : { value: null, invalid: true };
}

/* --------------------------------------------------------------- validation */

export function validateCsv(text: string, type: ImportType): ValidationResult {
  const grid = parseCsv(text);
  if (!grid.length) return { rows: [], validRows: [], errorRows: [] };

  const hasHeader = looksLikeHeader(grid[0]);
  const idx = hasHeader
    ? mapHeaders(grid[0])
    : type === 'active'
      ? { sr_no: 0, brand: 1, model_no: 2, description: 3, list_price: 4, sales_discount_pct: 5, purchase_discount_pct: 6, weight_kg: 7, dimensions: 8 }
      : { sr_no: 0, brand: 1, model_no: 2, description: 3, status: 4, sales_price: 5, purchase_price: 6 };

  const body = hasHeader ? grid.slice(1) : grid;
  const rows: ActiveImportRow[] = [];
  const seen = new Set<string>();

  body.forEach((cols, i) => {
    const get = (key: string) => (idx[key] !== undefined ? (cols[idx[key]] ?? '').trim() : '');
    const line_no = i + (hasHeader ? 2 : 1);
    const brand = get('brand');
    const model_no = get('model_no');
    const description = get('description');
    const errors: string[] = [];

    if (!brand) errors.push('Brand is required');
    if (!model_no) errors.push('Model No is required');
    if (!description) errors.push('Description is required');

    let list_price: number | null = null;
    let sales_discount_pct: number | null = null;
    let purchase_discount_pct: number | null = null;
    let sales_price: number | null = null;
    let purchase_price: number | null = null;
    let product_status: ProductStatus = 'active';

    if (type === 'active') {
      const lp = toNumber(get('list_price'));
      const sd = toNumber(get('sales_discount_pct'));
      const pd = toNumber(get('purchase_discount_pct'));

      if (lp.invalid) errors.push('List Price must be numeric');
      if (lp.value !== null && lp.value < 0) errors.push('List Price cannot be negative');
      if (sd.invalid) errors.push('Sales Discount must be numeric');
      if (pd.invalid) errors.push('Purchase Discount must be numeric');
      if (sd.value !== null && (sd.value < 0 || sd.value > 100)) errors.push(`Sales Discount = ${sd.value}% — discount must be between 0 and 100`);
      if (pd.value !== null && (pd.value < 0 || pd.value > 100)) errors.push(`Purchase Discount = ${pd.value}% — discount must be between 0 and 100`);

      list_price = lp.value;
      sales_discount_pct = sd.value;
      purchase_discount_pct = pd.value;
      sales_price = applyDiscount(list_price, sales_discount_pct);
      purchase_price = applyDiscount(list_price, purchase_discount_pct);
    } else {
      const statusRaw = norm(get('status'));
      if (statusRaw === 'discontinued') product_status = 'discontinued';
      else if (statusRaw === 'obsolete') product_status = 'obsolete';
      else errors.push('Status must be Discontinued or Obsolete');

      const sp = toNumber(get('sales_price'));
      const pp = toNumber(get('purchase_price'));
      if (sp.invalid || sp.value === null) errors.push('Sales Price must be numeric');
      else if (sp.value < 0) errors.push('Sales Price cannot be negative');
      if (pp.invalid || pp.value === null) errors.push('Purchase Price must be numeric');
      else if (pp.value < 0) errors.push('Purchase Price cannot be negative');

      sales_price = sp.value;
      purchase_price = pp.value;
    }

    // Logistics — always KG and CM, no unit selection anywhere.
    const wt = toNumber(get('weight_kg'));
    if (wt.invalid) errors.push('Weight (KG) must be numeric');
    if (wt.value !== null && wt.value < 0) errors.push('Weight cannot be negative');
    const dims = parseDimensions(get('dimensions'));
    if (dims.invalid) errors.push('Dimensions must be L × W × H in CM, e.g. 20 × 15 × 8');

    const key = `${brand.toUpperCase()}|${model_no.toUpperCase()}`;
    if (brand && model_no) {
      if (seen.has(key)) errors.push('Duplicate row in this file — later row wins');
      seen.add(key);
    }

    rows.push({
      line_no,
      sr_no: get('sr_no'),
      brand,
      model_no,
      description,
      list_price,
      sales_discount_pct,
      purchase_discount_pct,
      product_status,
      sales_price,
      purchase_price,
      gross_profit: grossProfit(sales_price, purchase_price),
      gross_margin_pct: grossMarginPct(sales_price, purchase_price),
      weight_kg: wt.value,
      length_cm: dims.length,
      width_cm: dims.width,
      height_cm: dims.height,
      error: errors.length ? errors.join('; ') : undefined,
    });
  });

  const errorRows = rows.filter((r) => r.error && !r.error.startsWith('Duplicate row'));
  const dupes = rows.filter((r) => r.error?.startsWith('Duplicate row'));
  const validRows = rows.filter((r) => !r.error || r.error.startsWith('Duplicate row'));

  // Later duplicate wins: keep only the last row for each brand+model
  const byKey = new Map<string, ActiveImportRow>();
  for (const r of validRows) byKey.set(`${r.brand.toUpperCase()}|${r.model_no.toUpperCase()}`, r);

  void dupes;
  return { rows, validRows: Array.from(byKey.values()), errorRows };
}

export function countDuplicates(rows: ActiveImportRow[]): number {
  return rows.filter((r) => r.error?.startsWith('Duplicate row')).length;
}

/* -------------------------------------------------------------- error CSV */

export function buildErrorCsv(rows: Array<{ line_no: number; sr_no?: string; brand: string; model_no: string; description: string; error?: string }>): string {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['Row', 'Sr No', 'Brand', 'Model No', 'Description', 'Error'];
  const body = rows.map((r) => [r.line_no, r.sr_no ?? '', r.brand, r.model_no, r.description, r.error ?? ''].map(esc).join(','));
  return [head.join(','), ...body].join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const ACTIVE_TEMPLATE_CSV =
  'Sr No,Brand,Model No,Description,List Price,Sales Discount %,Purchase Discount %,Weight (KG),Dimensions (L x W x H) (CM)\n' +
  '1,Siemens,6ES7511-1AK02-0AB0,S7-1500 CPU,100000,20,35,1.2,20 x 15 x 8\n';

export const LEGACY_TEMPLATE_CSV =
  'Sr No,Brand,Model No,Description,Status,Sales Price,Purchase Price\n' +
  '1,Siemens,6ES7-OLD,Old PLC,Obsolete,85000,70000\n';

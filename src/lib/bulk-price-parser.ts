// Simplified parser: procurement dumps only model_number + RMB price.
// Everything else (weight, %, FX) is filled by the approver in the calculator.

export interface ParsedPriceRow {
  raw: string;
  line_no: number;
  model_number: string;
  rmb_price: number;
  /** Bilingual error message when this line could not be fully parsed. */
  error?: string;
}

export function rowError(r: { model_number: string; rmb_price: number }): string | undefined {
  const noModel = !r.model_number.trim();
  const noPrice = !(r.rmb_price > 0);
  if (noModel && noPrice) return '缺少型号和 RMB 单价 / Missing model number and RMB unit price';
  if (noModel) return '缺少型号 / Missing model number';
  if (noPrice) return '缺少或无效的 RMB 单价 / Missing or invalid RMB unit price';
  return undefined;
}


function toNumber(s: string): number | null {
  const cleaned = s.replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;
  let norm = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) norm = cleaned.replace(/,/g, '');
  else if (cleaned.includes(',') && !cleaned.includes('.')) {
    const p = cleaned.split(',');
    norm = p.length === 2 && p[1].length <= 2 ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '');
  }
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : null;
}

function splitRow(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map(s => s.trim()).filter(Boolean);
  if (line.includes('|')) return line.split('|').map(s => s.trim()).filter(Boolean);
  const cols = line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
  if (cols.length >= 2) return cols;
  if ((line.match(/,/g) || []).length >= 1) return line.split(',').map(s => s.trim()).filter(Boolean);
  return line.split(/\s+/).map(s => s.trim()).filter(Boolean);
}

function isHeader(cols: string[]): boolean {
  const j = cols.join(' ').toLowerCase();
  return /\b(model|sku|item|product|price|qty|rmb|cny|型号|货号|单价|价格|数量)\b/.test(j)
    && !cols.some(c => toNumber(c) !== null && /^\s*[¥￥]?\s*[\d.,]+\s*(元|rmb|cny)?\s*$/i.test(c));
}

export function parseBulkPricePaste(raw: string): ParsedPriceRow[] {
  if (!raw?.trim()) return [];
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows: ParsedPriceRow[] = [];

  let lineNo = 0;
  for (const line of lines) {
    const cols = splitRow(line);
    if (isHeader(cols)) continue;
    lineNo += 1;

    // Model = first non-numeric token, price = last numeric token. No qty inference.
    const numericIdx: number[] = [];
    cols.forEach((c, i) => { if (toNumber(c) !== null) numericIdx.push(i); });

    const priceIdx = numericIdx.length ? numericIdx[numericIdx.length - 1] : -1;
    const parsedPrice = priceIdx >= 0 ? toNumber(cols[priceIdx]) : null;
    const price = parsedPrice !== null && parsedPrice > 0 ? parsedPrice : 0;

    const modelCol = cols.find((c, i) => !numericIdx.includes(i)) || (numericIdx.length === cols.length ? '' : cols[0] || '');
    const model = modelCol.replace(/[¥￥$]/g, '').trim().slice(0, 200);

    const row: ParsedPriceRow = { raw: line, line_no: lineNo, model_number: model, rmb_price: price };
    row.error = rowError(row);
    rows.push(row);
  }
  return rows;
}

/**
 * Canonical model-number normalisation used by import, search and lead matching.
 *
 * 6ES7 511-1AK02-0AB0  ->  6ES75111AK020AB0
 * 6es7511-1ak02-0ab0   ->  6ES75111AK020AB0
 * 6ES7511-1AK02-OABO   ->  6ES75111AK020AB0   (look-alike O/I/L folded)
 *
 * Must stay in sync with products.match_key in the database:
 *   translate(upper(regexp_replace(model_number,'[^a-zA-Z0-9]','','g')), 'OIL', '011')
 */
export function foldConfusables(value: string): string {
  return value.replace(/O/g, '0').replace(/[IL]/g, '1');
}

/** Strict form: case + separators only, no look-alike folding. */
export function stripModel(value: string | null | undefined): string {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeModel(value: string | null | undefined): string {
  return foldConfusables(stripModel(value));
}

export function normalizeBrand(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Brand form used for the database brand_match_key column. */
export function brandMatchKey(value: string | null | undefined): string {
  return foldConfusables(String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
}

/**
 * Splits a pasted list of part numbers ("A, B\nC") into separate probes.
 * A single part number that merely contains dashes/dots is returned as-is.
 */
export function splitModelList(text: string | null | undefined): string[] {
  const src = String(text ?? '').trim();
  if (!src) return [];
  const parts = src
    .split(/[,;\n\r\t]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  const out = new Set<string>(parts.length ? parts : [src]);
  out.add(src);
  return Array.from(out).slice(0, 5);
}

export function brandModelKey(brand: string | null | undefined, model: string | null | undefined): string {
  return `${normalizeBrand(brand)}|${normalizeModel(model)}`;
}

/** Model-number-ish tokens found in free text (leads, enquiry lines, e-mails). */
export function extractModelCandidates(text: string | null | undefined): string[] {
  const src = String(text ?? '');
  const out = new Set<string>();
  const re = /[A-Za-z0-9][A-Za-z0-9\-/. ]{4,40}[A-Za-z0-9]/g;
  for (const raw of src.match(re) ?? []) {
    const token = raw.trim();
    const n = normalizeModel(token);
    // must be reasonably long and mix letters + digits (typical industrial part codes)
    if (n.length >= 6 && /[A-Z]/.test(n) && /[0-9]/.test(n)) out.add(token);
  }
  return Array.from(out).slice(0, 20);
}

/** 0-100 similarity between two normalised model strings. */
export function modelSimilarity(a: string, b: string): number {
  const x = normalizeModel(a);
  const y = normalizeModel(b);
  if (!x || !y) return 0;
  if (x === y) return 100;
  if (x.startsWith(y) || y.startsWith(x)) return 88;
  if (x.includes(y) || y.includes(x)) return 78;

  // Levenshtein-based fallback
  const dist = levenshtein(x, y);
  const maxLen = Math.max(x.length, y.length);
  const score = Math.round((1 - dist / maxLen) * 100);
  return score > 0 ? score : 0;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export type MatchConfidence = 'high' | 'medium' | 'low';

export function confidenceFromScore(score: number): MatchConfidence {
  if (score >= 95) return 'high';
  if (score >= 75) return 'medium';
  return 'low';
}

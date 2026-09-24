/**
 * Shared heuristics for detecting truncated / broken product descriptions.
 * Used by:
 *  - PDF renderers to prefer a longer catalog description over a truncated snapshot
 *  - The list-price importer to reject fragment rows
 *  - Admin tooling to flag suspicious catalog rows
 */

export function isLikelyTruncatedDescription(
  description?: string | null,
  modelNumber?: string | null,
): boolean {
  const desc = (description || '').replace(/\s+/g, ' ').trim();
  if (!desc) return true;
  // Trailing comma / open punctuation → mid-sentence cut
  if (/[,;:\-–(]\s*$/.test(desc)) return true;
  // Very short and doesn't contain the model number
  const model = (modelNumber || '').trim();
  if (desc.length < 20 && (!model || !desc.toUpperCase().includes(model.toUpperCase()))) return true;
  // Starts with lowercase or punctuation → almost certainly a fragment
  if (/^[a-z]/.test(desc)) return true;
  if (/^[,;:\-–)]/.test(desc)) return true;
  return false;
}

/**
 * Choose the best printable description between the item snapshot and the linked
 * catalog description. Prefers the longer/non-truncated one.
 */
export function pickBestDescription(
  snapshot?: string | null,
  catalog?: string | null,
  modelNumber?: string | null,
): string {
  const s = (snapshot || '').trim();
  const c = (catalog || '').trim();
  if (!s) return c;
  if (!c) return s;
  const sBad = isLikelyTruncatedDescription(s, modelNumber);
  const cBad = isLikelyTruncatedDescription(c, modelNumber);
  if (sBad && !cBad) return c;
  if (!sBad && cBad) return s;
  // Both ok or both bad → pick the longer
  return c.length > s.length ? c : s;
}

/**
 * Derive a printable model number for a quotation line.
 * Falls back to the catalog product name when it is clearly a model code
 * (single token, or a leading code followed by descriptive text).
 */
export function deriveModelNumber(
  explicit?: string | null,
  productName?: string | null,
  description?: string | null,
): string | null {
  const direct = (explicit || '').trim();
  if (direct) return direct;

  const candidates = [productName, description];
  for (const raw of candidates) {
    const value = (raw || '').replace(/\s+/g, ' ').trim();
    if (!value) continue;
    if (!value.includes(' ')) {
      if (/[0-9]/.test(value) && value.length >= 4 && value.length <= 60) {
        return value.toUpperCase();
      }
      continue;
    }
    const match = value.match(/^([A-Za-z0-9][A-Za-z0-9._/-]{3,})(?:\s|$)/);
    const code = match?.[1];
    if (code && /[0-9]/.test(code) && /[A-Za-z]/.test(code) && code.length >= 5) {
      return code.toUpperCase();
    }
  }
  return null;
}

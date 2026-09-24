/**
 * Normalize a phone number to its 10-digit Indian mobile form.
 *
 * Rule:
 *  1. Strip everything that isn't a digit.
 *  2. Drop a leading "00" (international 00 prefix) then a leading "0".
 *  3. If still longer than 10 digits AND starts with "91" → drop that "91".
 *  4. If still longer than 10 digits → keep the last 10.
 *  5. Length ≤ 10 → return as-is (a pure 10-digit number starting with "91"
 *     such as 9180012345 is preserved untouched).
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
  if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
  if (d.length > 10) d = d.slice(-10);
  return d;
}

/**
 * Returns the 10-digit phone, or null if normalization didn't yield exactly 10 digits.
 */
export function normalizePhoneStrict(phone: string): string | null {
  const n = normalizePhone(phone);
  return n.length === 10 ? n : null;
}

/**
 * Check if two phone numbers match after normalization (both must be 10 digits).
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  const a = normalizePhone(phone1);
  const b = normalizePhone(phone2);
  return a.length === 10 && a === b;
}

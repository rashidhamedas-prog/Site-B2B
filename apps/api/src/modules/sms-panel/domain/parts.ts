/**
 * UCS-2 SMS parts (Persian/non-GSM): single ≤70, multi ⌈n/67⌉.
 * Spec §2.2 / UI-SPEC character counter.
 */

export function smsCharLength(body: string): number {
  // JS strings are UCS-2/UTF-16 code units — matches SMS segment rules for BMP Persian.
  return String(body || '').length;
}

export function countSmsParts(body: string): number {
  const n = smsCharLength(body);
  if (n <= 0) return 0;
  if (n <= 70) return 1;
  return Math.ceil(n / 67);
}

export function estimatePartsCost(bodies: string[]): number {
  return bodies.reduce((sum, b) => sum + countSmsParts(b), 0);
}

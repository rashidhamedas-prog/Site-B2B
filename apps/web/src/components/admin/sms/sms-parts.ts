/** UCS-2 SMS parts — keep in sync with API domain/parts.ts */
export function countSmsParts(body: string): number {
  const n = String(body || '').length;
  if (n <= 0) return 0;
  if (n <= 70) return 1;
  return Math.ceil(n / 67);
}

export function ensureOptOutFooter(body: string, messageClass: string): string {
  if (messageClass === 'OTP') return String(body || '');
  const text = String(body || '').replace(/\s+$/, '');
  if (/لغو\s*11|لغو۱۱/.test(text) || text.includes('لغو11')) return text;
  return `${text}\nلغو11`;
}

export function normalizeTypedCount(raw: string | number): number {
  return Number(
    String(raw)
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[^\d]/g, ''),
  );
}

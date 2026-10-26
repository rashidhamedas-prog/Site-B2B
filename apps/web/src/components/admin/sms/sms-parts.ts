/** UCS-2 SMS parts — keep in sync with API domain/parts.ts */
export function countSmsParts(body: string): number {
  const n = String(body || '').length;
  if (n <= 0) return 0;
  if (n <= 70) return 1;
  return Math.ceil(n / 67);
}

const DIGIT_FA_AR: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/** True only if trimmed body ends with «لغو11» (sync with API domain/template). */
export function hasOptOutFooter(body: string): boolean {
  const src = String(body || '').trimEnd();
  let compact = '';
  for (let i = Math.max(0, src.length - 32); i < src.length; i++) {
    const ch = src.charAt(i);
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') continue;
    compact += DIGIT_FA_AR[ch] ?? ch;
  }
  return compact.endsWith('لغو11');
}

export function ensureOptOutFooter(body: string, messageClass: string): string {
  if (messageClass === 'OTP') return String(body || '');
  const text = String(body || '').trimEnd();
  if (hasOptOutFooter(text)) return text;
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

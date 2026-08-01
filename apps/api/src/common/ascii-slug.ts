/**
 * ASCII-only URL slugs (no Persian / percent-encoding when copied).
 */

const FA_MAP: Record<string, string> = {
  ا: 'a',
  آ: 'a',
  أ: 'a',
  إ: 'e',
  ب: 'b',
  پ: 'p',
  ت: 't',
  ث: 's',
  ج: 'j',
  چ: 'ch',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'z',
  ر: 'r',
  ز: 'z',
  ژ: 'zh',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'z',
  ط: 't',
  ظ: 'z',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'gh',
  ک: 'k',
  ك: 'k',
  گ: 'g',
  ل: 'l',
  م: 'm',
  ن: 'n',
  و: 'v',
  ه: 'h',
  ة: 'h',
  ی: 'y',
  ي: 'y',
  ى: 'y',
  ئ: 'y',
  ء: '',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

/** Transliterate Persian/Arabic letters then keep only [a-z0-9-]. */
export function asciiSlug(input: string, fallback = 'item'): string {
  const raw = String(input || '').trim();
  if (!raw) return fallback;

  let out = '';
  for (const ch of raw) {
    if (Object.prototype.hasOwnProperty.call(FA_MAP, ch)) {
      out += FA_MAP[ch];
      continue;
    }
    if (/[A-Za-z0-9]/.test(ch)) {
      out += ch.toLowerCase();
      continue;
    }
    if (/\s|_/.test(ch) || ch === '-' || ch === '–' || ch === '—') {
      out += '-';
      continue;
    }
    out += '-';
  }

  const cleaned = out
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);

  return cleaned || fallback;
}

export function hasNonAsciiSlug(slug: string): boolean {
  return /[^\x00-\x7F]/.test(String(slug || ''));
}

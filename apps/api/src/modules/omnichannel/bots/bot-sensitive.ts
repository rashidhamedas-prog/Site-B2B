/**
 * PR-14 deterministic sensitive classifier (no LLM).
 * Hit → SENSITIVE_HOLD; inbox tag; forward ownerChatId only (never personal Hamed DM).
 */

export const SENSITIVE_TAG = 'sensitive';

const KEYWORDS = [
  'اعتبار',
  'چک',
  'نسیه',
  'قیمت ویژه',
  'شکایت',
  'مرجوع',
  'همکار ویژه',
  'زیر قیمت',
  'زیرلیست',
];

export function normalizeBotText(text: unknown): string {
  return String(text || '')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function findSensitiveKeyword(text: unknown): string | null {
  const n = normalizeBotText(text);
  if (!n) return null;
  for (const kw of KEYWORDS) {
    if (n.includes(normalizeBotText(kw))) return kw;
  }
  return null;
}

export type SensitiveDecision = {
  sensitive: boolean;
  reason: 'keyword' | 'first_order' | null;
  keyword: string | null;
};

/**
 * @param hasPriorPfi true when this provider+customerChatId already linked an order/PFI
 */
export function classifySensitive(input: {
  text: unknown;
  hasPriorPfi: boolean;
}): SensitiveDecision {
  const keyword = findSensitiveKeyword(input.text);
  if (keyword) {
    return { sensitive: true, reason: 'keyword', keyword };
  }
  if (!input.hasPriorPfi) {
    return { sensitive: true, reason: 'first_order', keyword: null };
  }
  return { sensitive: false, reason: null, keyword: null };
}

export const SENSITIVE_CUSTOMER_COPY =
  'درخواست شما ثبت شد. کارشناس پیگیری می‌کند.';

export function ensureSensitiveTag(tags: string[] | null | undefined): string[] {
  const next = Array.isArray(tags) ? [...tags] : [];
  if (!next.includes(SENSITIVE_TAG)) next.push(SENSITIVE_TAG);
  return next;
}

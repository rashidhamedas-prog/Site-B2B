export type SmsMessageClass = 'OTP' | 'TRANSACTIONAL' | 'PROMO';

export const OPT_OUT_FOOTER = 'لغو11';

const PLACEHOLDER_RE = /\{(\w+)\}/g;

export function extractPlaceholders(body: string): string[] {
  const found = new Set<string>();
  const s = String(body || '');
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  while ((m = re.exec(s))) found.add(m[1]);
  return [...found];
}

/** Strict fill: unknown placeholder throws. */
export function fillTemplateStrict(
  body: string,
  vars: Record<string, string>,
  allowed?: string[],
): string {
  const allowedSet = allowed ? new Set(allowed) : null;
  return String(body || '').replace(PLACEHOLDER_RE, (_, key: string) => {
    if (allowedSet && !allowedSet.has(key)) {
      throw new Error(`UNKNOWN_PLACEHOLDER:${key}`);
    }
    if (vars[key] == null) {
      throw new Error(`MISSING_PLACEHOLDER:${key}`);
    }
    return String(vars[key]);
  });
}

const DIGIT_FA_AR: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/** Strip whitespace without polynomial regex (CodeQL-safe). */
function stripWs(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === '\u00a0') continue;
    out += DIGIT_FA_AR[ch] ?? ch;
  }
  return out;
}

function rtrim(raw: string): string {
  let end = raw.length;
  while (end > 0) {
    const ch = raw[end - 1];
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') end -= 1;
    else break;
  }
  return raw.slice(0, end);
}

export function hasOptOutFooter(body: string): boolean {
  const normalized = stripWs(String(body || ''));
  return (
    normalized.endsWith('لغو11') ||
    normalized.includes('لغو11') ||
    normalized.endsWith('11')
  );
}

/** Append locked «لغو11» for PROMO/TRANSACTIONAL (not OTP). Idempotent. */
export function ensureOptOutFooter(body: string, messageClass: SmsMessageClass): string {
  if (messageClass === 'OTP') return String(body || '');
  const text = rtrim(String(body || ''));
  if (hasOptOutFooter(text)) return text;
  return `${text}\n${OPT_OUT_FOOTER}`;
}

/** Server-owned UTF-8. Never build this string in a Windows SSH one-liner. */
export const CANARY_PING_TEXT =
  'تست اتصال ترنم. اگر این پیام را فارسی می‌بینید، رمزگذاری درست است.';

export function canaryPingHasPersian(text = CANARY_PING_TEXT): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function canaryPingLooksMojibake(text = CANARY_PING_TEXT): boolean {
  return /\?{2,}/.test(text) || !canaryPingHasPersian(text);
}

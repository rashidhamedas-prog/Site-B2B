/**
 * Soft photo-skip notes on a successful Bale/Telegram delivery
 * (`lastError` like `warnings:photo_1_failed;photo_2_failed`).
 * Not a failure — do not feed into failure counters / retry UI.
 */
export function isDeliveryPhotoWarning(error?: string | null): boolean {
  return String(error || '').trim().toLowerCase().startsWith('warnings:');
}

/** Strip `warnings:` and map known tokens to short Persian copy. */
export function deliveryWarningLabel(error?: string | null): string {
  const raw = String(error || '').trim();
  if (!isDeliveryPhotoWarning(raw)) return raw;
  const body = raw.replace(/^warnings:\s*/i, '').trim();
  if (!body) return 'موفق با هشدار رسانه';
  const parts = body.split(/[|;]/).map((p) => p.trim()).filter(Boolean);
  const mapped = parts.map((token) => {
    const lower = token.toLowerCase();
    if (lower.startsWith('photo_skipped')) return 'یک یا چند عکس رد شد';
    if (/^photo_\d+_failed$/i.test(token) || lower.includes('photo') && lower.includes('fail')) {
      return 'ارسال بخشی از عکس‌ها ناموفق بود';
    }
    if (lower.includes('unsupported')) return 'فرمت یا حجم تصویر پشتیبانی نشد';
    return token.length > 48 ? `${token.slice(0, 45)}…` : token;
  });
  const unique = [...new Set(mapped)];
  return unique.join(' · ') || 'موفق با هشدار رسانه';
}

/**
 * Align with API `isNonRetryableProviderError` — same bytes will not succeed on retry.
 * Used to hide/disable «تلاش دوباره» and block manual requeue.
 */
export function isNonRetryableDeliveryError(error?: string | null): boolean {
  const text = String(error || '').toLowerCase();
  if (!text) return false;
  return (
    text.includes('unsupported_media')
    || text.includes('unsupported_file')
    || text.includes('unsupported file')
    || text.includes('file_too_large')
    || text.includes('file too large')
    || text.includes('request entity too large')
    || text.includes('photo_too_large')
  );
}

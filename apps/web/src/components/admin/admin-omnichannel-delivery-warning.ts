/**
 * Soft photo-skip notes on a successful Bale/Telegram delivery
 * (`lastError` like `warnings:photo_1_failed;photo_2_failed`).
 * Not a failure — do not feed into failure counters / retry UI.
 */
export function isDeliveryPhotoWarning(error?: string | null): boolean {
  return String(error || '').trim().toLowerCase().startsWith('warnings:');
}

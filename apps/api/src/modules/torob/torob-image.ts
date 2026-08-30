export const MIN_TOROB_IMAGE_PX = 400;

const THUMB_RE =
  /(?:^|[/_-])(?:thumb|thumbnail|small|tiny|icon|\d{1,2}x\d{1,2})(?:[/_.-]|$)/i;

export type ImageSkipReason =
  | 'missing_image'
  | 'image_not_absolute'
  | 'image_not_https'
  | 'image_thumbnail'
  | 'image_url_too_long'
  | 'image_too_small';

export function isPublishableImageUrl(
  url: string,
  dimensions?: { width?: number; height?: number } | null,
): { ok: boolean; reason?: ImageSkipReason; warning?: string } {
  if (!url?.trim()) return { ok: false, reason: 'missing_image' };
  if (url.length > 1000) return { ok: false, reason: 'image_url_too_long' };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'image_not_absolute' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'image_not_https' };
  if (THUMB_RE.test(parsed.pathname)) return { ok: false, reason: 'image_thumbnail' };
  const width = Number(dimensions?.width) || 0;
  const height = Number(dimensions?.height) || 0;
  if ((width > 0 || height > 0) && Math.min(width || MIN_TOROB_IMAGE_PX, height || MIN_TOROB_IMAGE_PX) < MIN_TOROB_IMAGE_PX) {
    return { ok: false, reason: 'image_too_small' };
  }
  return {
    ok: true,
    warning:
      width === 0 && height === 0
        ? `image dimensions unknown; Torob rejects images smaller than ${MIN_TOROB_IMAGE_PX}px`
        : undefined,
  };
}

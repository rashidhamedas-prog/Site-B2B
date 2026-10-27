const ALLOWED_OBJECT_KEY = /^(products|blog)\/[A-Za-z0-9._/-]+$/;
const ORIGINALS_PREFIX = 'originals/';

/** Sibling JPEG for Bale/Rubika/Telegram multipart; never appears in public product URLs. */
export const CHANNEL_JPEG_SUFFIX = '.channel.jpg';

/** Reject path traversal and keys outside the public media prefixes. */
export function sanitizeObjectKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/%2e/i.test(raw) || raw.includes('\\')) return null;
  let key = raw.split('?')[0].split('#')[0];
  try {
    key = decodeURIComponent(key);
  } catch {
    return null;
  }
  key = key.replace(/^\/+/, '');
  if (!key || key.includes('..') || key.includes('\\') || key.includes('\0')) return null;
  if (!ALLOWED_OBJECT_KEY.test(key)) return null;
  return key;
}

/** Deterministic channel JPEG key next to the site WebP (e.g. products/a.webp.channel.jpg). */
export function channelDerivativeKey(mainKey: string | null | undefined): string | null {
  const safe = sanitizeObjectKey(mainKey);
  if (!safe) return null;
  if (safe.endsWith(CHANNEL_JPEG_SUFFIX)) return safe;
  return sanitizeObjectKey(`${safe}${CHANNEL_JPEG_SUFFIX}`);
}

/**
 * Private raw upload under originals/. Not allowlisted for public reads.
 * Returns null when the main key is unsafe.
 */
export function originalUploadKey(mainKey: string | null | undefined): string | null {
  const safe = sanitizeObjectKey(mainKey);
  if (!safe) return null;
  const candidate = `${ORIGINALS_PREFIX}${safe}`;
  if (candidate.includes('..') || candidate.includes('\\') || candidate.includes('\0')) return null;
  if (!candidate.startsWith(ORIGINALS_PREFIX)) return null;
  return candidate;
}

/** Main object + channel JPEG + optional private original. Used on delete. */
export function relatedObjectKeys(mainKey: string | null | undefined): string[] {
  const safe = sanitizeObjectKey(mainKey);
  if (!safe) return [];
  const out = [safe];
  const channel = channelDerivativeKey(safe);
  if (channel && channel !== safe) out.push(channel);
  const original = originalUploadKey(safe);
  if (original) out.push(original);
  return out;
}

export function isMissingObjectError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  return /NoSuchKey|not found|404|NotFound|NoSuchObject/i.test(`${code} ${msg}`);
}

export function keepOriginalUploads(
  source: { KEEP_ORIGINAL_UPLOADS?: string | undefined } = process.env,
): boolean {
  return String(source.KEEP_ORIGINAL_UPLOADS ?? '').trim().toLowerCase() === 'true';
}

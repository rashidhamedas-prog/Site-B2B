const ALLOWED_OBJECT_KEY = /^(products|blog)\/[A-Za-z0-9._/-]+$/;

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

export function isMissingObjectError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : '';
  return /NoSuchKey|not found|404|NotFound|NoSuchObject/i.test(`${code} ${msg}`);
}

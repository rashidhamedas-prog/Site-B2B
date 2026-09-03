/** Same-origin relative path only. Rejects protocol-relative and scheme URLs. */
export function safeAccountRedirect(raw: string | null | undefined, fallback = '/account'): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  if (value.includes('://') || value.includes('\\')) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return fallback;
  return value;
}

/** Relative path that stays under one of the allowed prefixes (portal/admin). */
export function safeScopedRedirect(
  raw: string | null | undefined,
  fallback: string,
  allowedPrefixes: readonly string[],
): string {
  const candidate = safeAccountRedirect(raw, fallback);
  const allowed = allowedPrefixes.some((prefix) => {
    if (candidate === prefix) return true;
    return candidate.startsWith(`${prefix}/`) || candidate.startsWith(`${prefix}?`) || candidate.startsWith(`${prefix}#`);
  });
  if (!allowed) return fallback;
  if (candidate.startsWith('/portal/login') || candidate.startsWith('/admin/login')) return fallback;
  return candidate;
}

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

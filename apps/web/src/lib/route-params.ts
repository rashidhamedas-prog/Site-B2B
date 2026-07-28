/**
 * Decode dynamic route params that may arrive still percent-encoded
 * (common with unicode slugs after middleware rewrite / proxies).
 */
export function decodeRouteParam(value: string): string {
  if (!value) return value;
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    if (!/%[0-9A-Fa-f]{2}/.test(current)) break;
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

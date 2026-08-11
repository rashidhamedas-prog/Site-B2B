/**
 * Client IP for abuse controls (rate limit, unique views, comment hashing).
 *
 * Uses ONLY Nest/Fastify `req.ip` after `trustProxy` is configured in main.ts.
 * Never read raw `x-forwarded-for` / `x-real-ip` from the client — those are
 * spoofable when the app trusts the header without a trusted reverse-proxy hop.
 */
export type IpBearingRequest = {
  ip?: string;
};

export function extractClientIp(req: IpBearingRequest | null | undefined): string {
  const raw = typeof req?.ip === 'string' ? req.ip.trim() : '';
  if (!raw) return '0.0.0.0';
  // Fastify may return comma-joined when trustProxy is misconfigured; take first token only from req.ip value.
  const first = raw.split(',')[0]?.trim() || '';
  return first || '0.0.0.0';
}

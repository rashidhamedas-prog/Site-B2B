import { importSPKI, jwtVerify } from 'jose';

/** Official Torob Ed25519 public key (Torob-Sync token guide). Not a secret. */
export const TOROB_OFFICIAL_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAt6Mu4T0pBORY11W+QeM35UsmLO3vsf+6yKpFDEImFk0=
-----END PUBLIC KEY-----`;

export const TOROB_TOKEN_VERSION = '1';
export const DEFAULT_TOROB_API_AUDIENCE = 'www.poshaktaranom.ir';

export function resolveTorobAudience(): string {
  const configured = String(process.env.TOROB_API_AUDIENCE || DEFAULT_TOROB_API_AUDIENCE)
    .trim()
    .toLowerCase();
  return configured || DEFAULT_TOROB_API_AUDIENCE;
}

export function isNonProductionAppEnv(): boolean {
  const env = String(process.env.APP_ENV || process.env.NODE_ENV || '')
    .trim()
    .toLowerCase();
  return env === 'test' || env === 'staging' || env === 'local' || env === 'disposable';
}

export function resolveTorobPublicKeyPem(): string {
  const override = String(process.env.TOROB_JWT_PUBLIC_KEY || '').trim();
  if (override && isNonProductionAppEnv()) return override;
  return TOROB_OFFICIAL_PUBLIC_KEY_PEM;
}

export function resolveTorobOrderAudience(): string {
  const configured = String(process.env.TOROB_ORDER_API_AUDIENCE || 'www.poshaktaranom.ir')
    .trim()
    .toLowerCase();
  return configured || 'www.poshaktaranom.ir';
}

/** Same shop, www and apex. Not a list of unrelated hosts. */
export function resolveTorobOrderAudiences(): string[] {
  const primary = resolveTorobOrderAudience();
  const extras = String(process.env.TOROB_ORDER_API_AUDIENCES || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const aliases = [primary];
  if (primary.startsWith('www.')) aliases.push(primary.slice(4));
  else aliases.push(`www.${primary}`);
  const hosts = [...new Set([...aliases, ...extras])];
  return [
    ...new Set(
      hosts.flatMap((host) => [
        host,
        `https://${host}`,
        `https://${host}/api/torob/v1/orders`,
        `https://${host}/torob/v1/orders`,
      ]),
    ),
  ];
}

export function extractTorobToken(headers: Record<string, unknown> | undefined): string {
  const direct = String(headers?.['x-torob-token'] || '').trim();
  if (direct) return direct;
  const auth = String(headers?.authorization || headers?.Authorization || '').trim();
  const match = /^Bearer\s+(\S+)/i.exec(auth);
  return match?.[1] || '';
}

export function peekTorobJwtAud(token: string): string | undefined {
  const parts = token.split('.');
  if (parts.length < 2) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      aud?: unknown;
    };
    return typeof payload.aud === 'string' ? payload.aud : undefined;
  } catch {
    return undefined;
  }
}

export async function verifyTorobJwt(input: {
  token?: string | null;
  version?: string | null;
  audience?: string | string[];
  now?: Date;
}): Promise<{ audience: string | string[] }> {
  const token = String(input.token || '').trim();
  const version = String(input.version || '').trim() || TOROB_TOKEN_VERSION;
  if (!token) {
    throw new Error('missing X-Torob-Token');
  }
  if (version !== TOROB_TOKEN_VERSION) {
    throw new Error('invalid X-Torob-Token-Version');
  }
  const audience = input.audience
    ? Array.isArray(input.audience)
      ? input.audience.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
      : String(input.audience).trim().toLowerCase()
    : resolveTorobAudience();
  const key = await importSPKI(resolveTorobPublicKeyPem(), 'EdDSA');
  await jwtVerify(token, key, {
    algorithms: ['EdDSA'],
    audience,
    requiredClaims: ['exp', 'nbf', 'aud'],
    currentDate: input.now,
  });
  return { audience };
}

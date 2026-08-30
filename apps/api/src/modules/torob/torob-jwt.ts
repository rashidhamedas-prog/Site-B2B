import { importSPKI, jwtVerify } from 'jose';

/** Official Torob Ed25519 public key (Torob-Sync token guide). Not a secret. */
export const TOROB_OFFICIAL_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAt6Mu4T0pBORY11W+QeM35UsmLO3vsf+6yKpFDEImFk0=
-----END PUBLIC KEY-----`;

export const TOROB_TOKEN_VERSION = '1';
export const DEFAULT_TOROB_API_AUDIENCE = 'api.poshaktaranom.com';

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

export async function verifyTorobJwt(input: {
  token?: string | null;
  version?: string | null;
  audience?: string;
  now?: Date;
}): Promise<{ audience: string }> {
  const token = String(input.token || '').trim();
  const version = String(input.version || '').trim();
  if (!token) {
    throw new Error('missing X-Torob-Token');
  }
  if (version !== TOROB_TOKEN_VERSION) {
    throw new Error('invalid X-Torob-Token-Version');
  }
  const audience = String(input.audience || resolveTorobAudience()).trim().toLowerCase();
  const key = await importSPKI(resolveTorobPublicKeyPem(), 'EdDSA');
  await jwtVerify(token, key, {
    algorithms: ['EdDSA'],
    audience,
    requiredClaims: ['exp', 'nbf', 'aud'],
    currentDate: input.now,
  });
  return { audience };
}

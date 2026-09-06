import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import { isAllowedSecretRef } from './omnichannel-secrets';

export const OMNICHANNEL_VAULT_SETTING_KEY = 'omnichannel.secret.vault';
export const VAULT_ALG = 'aes-256-gcm';
const VAULT_SALT = 'omnichannel-secret-vault-v1';

/** Telegram / Bale BotFather tokens: digits:secret. Rubika uses an opaque bot token. */
const TELEGRAM_LIKE = /^\d{6,}:[A-Za-z0-9_-]{20,200}$/;
const OPAQUE_TOKEN = /^[A-Za-z0-9._-]{20,256}$/;

export type VaultCipher = {
  alg: typeof VAULT_ALG;
  iv: string;
  tag: string;
  ct: string;
};

export type VaultEntryPublic = {
  fingerprint: string;
  updatedAt: string | null;
};

export type StoredVaultEntry = VaultCipher & VaultEntryPublic;

export type StoredVault = {
  v: 1;
  entries: Record<string, StoredVaultEntry>;
};

export type TokenSource = 'none' | 'env' | 'vault' | 'both';

export type SecretStatus = {
  secretRef: string;
  configured: boolean;
  source: TokenSource;
  fingerprint: string | null;
  updatedAt: string | null;
};

const overlay = new Map<string, string>();
const overlayMeta = new Map<string, VaultEntryPublic>();

export function isProductionLike(env: NodeJS.ProcessEnv = process.env): boolean {
  const node = String(env.NODE_ENV || '').toLowerCase();
  const app = String(env.APP_ENV || '').toLowerCase();
  return node === 'production' || app === 'production' || app === 'staging';
}

/** Production/staging require a dedicated KEK. JWT fallback is local/dev only. */
export function deriveVaultKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const explicit = String(env.OMNICHANNEL_VAULT_KEY || '').trim();
  if (explicit.length >= 32) return scryptSync(explicit, VAULT_SALT, 32);
  if (isProductionLike(env)) throw new Error('vault_key_missing');
  const jwt = String(env.JWT_SECRET || '').trim();
  if (jwt.length < 16) throw new Error('vault_key_missing');
  return scryptSync(jwt, VAULT_SALT, 32);
}

export function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex').slice(0, 8);
}

export function encryptToken(plaintext: string, key: Buffer, aad = ''): VaultCipher {
  const iv = randomBytes(12);
  const cipher = createCipheriv(VAULT_ALG, key, iv, { authTagLength: 16 });
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    alg: VAULT_ALG,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ct: ct.toString('base64'),
  };
}

function openToken(row: VaultCipher, key: Buffer, aad: string): string {
  const decipher = createDecipheriv(VAULT_ALG, key, Buffer.from(row.iv, 'base64'), { authTagLength: 16 });
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(row.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.ct, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function decryptToken(row: VaultCipher, key: Buffer, aad = ''): string {
  if (!row || row.alg !== VAULT_ALG || !row.iv || !row.tag || !row.ct) {
    throw new Error('vault_corrupt');
  }
  const tag = Buffer.from(row.tag, 'base64');
  if (tag.length !== 16) throw new Error('vault_corrupt');
  try {
    return openToken(row, key, aad);
  } catch {
    if (!aad) throw new Error('vault_corrupt');
    return openToken(row, key, '');
  }
}

export function assertTokenShape(provider: string, token: string): void {
  if (token !== token.trim() || /\s/.test(token)) {
    throw new Error('token_whitespace');
  }
  if (token.length < 20 || token.length > 256) {
    throw new Error('token_length');
  }
  if (provider === 'TELEGRAM' || provider === 'BALE') {
    if (!TELEGRAM_LIKE.test(token)) throw new Error('token_shape');
    return;
  }
  if (provider === 'RUBIKA') {
    if (!OPAQUE_TOKEN.test(token)) throw new Error('token_shape');
    return;
  }
  throw new Error('token_provider');
}

export function providerFromSecretRef(secretRef: string): string | null {
  const name = String(secretRef || '').trim();
  if (!isAllowedSecretRef(name)) return null;
  const prefix = name.split('_')[0];
  return prefix || null;
}

export function peekVaultToken(secretRef: string): string | null {
  const name = String(secretRef || '').trim();
  if (!isAllowedSecretRef(name)) return null;
  const value = overlay.get(name);
  return value && value.trim() ? value.trim() : null;
}

export function peekVaultMeta(secretRef: string): VaultEntryPublic | null {
  const name = String(secretRef || '').trim();
  return overlayMeta.get(name) || null;
}

export function setVaultOverlayEntry(secretRef: string, token: string | null, meta?: VaultEntryPublic | null): void {
  const name = String(secretRef || '').trim();
  if (!isAllowedSecretRef(name)) return;
  if (!token) {
    overlay.delete(name);
    overlayMeta.delete(name);
    return;
  }
  overlay.set(name, token);
  overlayMeta.set(name, meta || { fingerprint: tokenFingerprint(token), updatedAt: null });
}

/** Replace the in-process overlay. Used after decrypting the persisted vault. */
export function applyVaultOverlay(
  entries: Record<string, string>,
  meta: Record<string, VaultEntryPublic> = {},
): void {
  overlay.clear();
  overlayMeta.clear();
  for (const [name, token] of Object.entries(entries)) {
    setVaultOverlayEntry(name, token, meta[name] || null);
  }
}

export function vaultOverlayRefs(): string[] {
  return [...overlay.keys()];
}

export function parseStoredVault(raw: unknown): StoredVault {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const entriesIn = value.entries && typeof value.entries === 'object' && !Array.isArray(value.entries)
    ? (value.entries as Record<string, unknown>)
    : {};
  const entries: Record<string, StoredVaultEntry> = {};
  for (const [name, row] of Object.entries(entriesIn)) {
    if (!isAllowedSecretRef(name) || !row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    if (item.alg !== VAULT_ALG) continue;
    entries[name] = {
      alg: VAULT_ALG,
      iv: String(item.iv || ''),
      tag: String(item.tag || ''),
      ct: String(item.ct || ''),
      fingerprint: String(item.fingerprint || ''),
      updatedAt: item.updatedAt ? String(item.updatedAt) : null,
    };
  }
  return { v: 1, entries };
}

export function publicSecretStatus(
  secretRef: string,
  env: NodeJS.ProcessEnv = process.env,
): SecretStatus {
  const name = String(secretRef || '').trim();
  const inVault = !!peekVaultToken(name);
  const inEnv = String(env[name] || '').trim().length > 0;
  const meta = peekVaultMeta(name);
  const source: TokenSource = inVault && inEnv ? 'both' : inVault ? 'vault' : inEnv ? 'env' : 'none';
  return {
    secretRef: name,
    configured: source !== 'none',
    source,
    fingerprint: meta?.fingerprint || null,
    updatedAt: meta?.updatedAt || null,
  };
}

export function envProviderRefs(env: NodeJS.ProcessEnv = process.env): string[] {
  return Object.keys(env).filter((name) => isAllowedSecretRef(name) && String(env[name] || '').trim());
}

/** Never include ciphertext or plaintext in a public payload. */
export function assertNoVaultLeak(payload: unknown): void {
  const text = JSON.stringify(payload);
  if (!text) return;
  if (/"ct"|"iv"|"tag"/.test(text) || /"token"\s*:/.test(text) || TELEGRAM_LIKE.test(text)) {
    throw new Error('vault_payload_leak');
  }
  for (const value of overlay.values()) {
    if (value && text.includes(value)) throw new Error('vault_payload_leak');
  }
}

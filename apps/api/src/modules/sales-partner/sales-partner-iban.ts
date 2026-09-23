import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { ibanLast4, normalizeIban } from './sales-partner-policy';

function ibanKey(secret: string): Buffer {
  return createHmac('sha256', secret).update('sales-partner-iban-v1').digest();
}

export function fingerprintIban(iban: string, secret: string): string {
  const normalized = normalizeIban(iban);
  return createHmac('sha256', secret).update(`iban-fp:${normalized}`).digest('hex');
}

/** AES-256-GCM. Ciphertext format: base64(iv 12 | tag 16 | ciphertext). */
export function cipherIban(iban: string, secret: string): string {
  const normalized = normalizeIban(iban);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ibanKey(secret), iv);
  const enc = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decipherIban(payload: string, secret: string): string {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < 29) throw new Error('INVALID_IBAN_CIPHER');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', ibanKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function ibanRecord(iban: string, secret: string): {
  ibanLast4: string;
  ibanFingerprint: string;
  ibanCipher: string;
} {
  const normalized = normalizeIban(iban);
  return {
    ibanLast4: ibanLast4(normalized),
    ibanFingerprint: fingerprintIban(normalized, secret),
    ibanCipher: cipherIban(normalized, secret),
  };
}

export function resolveIbanSecret(jwtSecret: string | undefined, dedicated?: string): string {
  const key = String(dedicated || '').trim() || String(jwtSecret || '').trim();
  if (key.length < 16) throw new Error('IBAN_SECRET_MISSING');
  return key;
}

export function requireDedicatedIbanKey(appEnv: string | undefined, dedicated?: string): void {
  const env = String(appEnv || '').toLowerCase();
  if ((env === 'production' || env === 'staging') && !String(dedicated || '').trim()) {
    throw new Error('SALES_PARTNER_IBAN_KEY_REQUIRED');
  }
}

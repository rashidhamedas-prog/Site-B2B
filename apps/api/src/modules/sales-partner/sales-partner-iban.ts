import { createHash, createHmac } from 'crypto';
import { ibanLast4, normalizeIban } from './sales-partner-policy';

export function fingerprintIban(iban: string, secret: string): string {
  const normalized = normalizeIban(iban);
  return createHmac('sha256', secret).update(normalized).digest('hex');
}

export function cipherIban(iban: string, secret: string): string {
  const normalized = normalizeIban(iban);
  const key = createHash('sha256').update(secret).digest();
  const chars = Buffer.from(normalized, 'utf8');
  const out = Buffer.alloc(chars.length);
  for (let i = 0; i < chars.length; i += 1) {
    out[i] = chars[i] ^ key[i % key.length];
  }
  return out.toString('base64');
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

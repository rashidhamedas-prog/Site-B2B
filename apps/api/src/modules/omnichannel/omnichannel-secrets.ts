import { BadRequestException } from '@nestjs/common';
import { FORBIDDEN_SECRET_KEYS } from './omnichannel.constants';

const FORBIDDEN = new Set(FORBIDDEN_SECRET_KEYS.map((k) => k.toLowerCase().replace(/[_-]/g, '')));
const ALLOWED_SECRET_REF = /^(TELEGRAM|BALE|RUBIKA)_[A-Z0-9_]{1,80}$/;
const TELEGRAM_TOKEN_SHAPE = /\d{6,}:[A-Za-z0-9_-]{20,}/;

export function isAllowedSecretRef(name: string): boolean {
  return ALLOWED_SECRET_REF.test(String(name || '').trim());
}

export function looksLikeSecretValue(value: string): boolean {
  const v = value.trim();
  if (v.length < 8) return false;
  if (/^SECRET_REF:/i.test(v)) return false;
  if (isAllowedSecretRef(v)) return false;
  if (TELEGRAM_TOKEN_SHAPE.test(v)) return true;
  return /^(bot\d+:|sk-|ghp_|xox[baprs]-)/i.test(v) || /token|secret|password/i.test(v);
}

function isForbiddenSecretKey(key: string): boolean {
  const raw = key.toLowerCase();
  if (raw === 'secretref') return false;
  const compact = raw.replace(/[_-]/g, '');
  if (FORBIDDEN.has(raw) || FORBIDDEN.has(compact)) return true;
  return /(token|secret|password|apikey|privatekey|credential|botkey)$/.test(compact);
}

export function assertNoPlaintextSecrets(input: unknown, path = 'body'): void {
  if (input == null) return;
  if (typeof input === 'string') {
    if (looksLikeSecretValue(input)) {
      throw new BadRequestException('مقدار محرمانه در بدنه مجاز نیست؛ فقط secretRef');
    }
    return;
  }
  if (Array.isArray(input)) {
    input.forEach((item, i) => assertNoPlaintextSecrets(item, `${path}[${i}]`));
    return;
  }
  if (typeof input === 'object') {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (isForbiddenSecretKey(key)) {
        throw new BadRequestException(`فیلد ${key} مجاز نیست؛ فقط secretRef ذخیره می‌شود`);
      }
      assertNoPlaintextSecrets(value, `${path}.${key}`);
    }
  }
}

export function toPublicConnection<T extends { secretRef?: string | null }>(row: T): T {
  return { ...row, secretRef: row.secretRef ? String(row.secretRef) : null };
}

/** Public shape: isCanary flag + server-written verification snapshot only; never raw settings. */
export function toPublicDestination<T extends { settings?: Record<string, unknown> }>(
  row: T,
): Omit<T, 'settings'> & { isCanary: boolean; verified: Record<string, unknown> | null } {
  const { settings, ...rest } = row;
  const verified = settings?.verified;
  return {
    ...rest,
    isCanary: settings?.isCanary === true,
    verified: verified && typeof verified === 'object' && !Array.isArray(verified)
      ? (verified as Record<string, unknown>)
      : null,
  };
}

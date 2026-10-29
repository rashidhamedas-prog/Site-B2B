import { telegramApiBase } from './adapters/telegram.adapter';

/** Official Bale Bot API host. Used when `BALE_API_URL` is unset or blank. */
export const BALE_API_DEFAULT = 'https://tapi.bale.ai';

/** Official Rubika Bot API v3 prefix. Used when `RUBIKA_API_URL` is unset or blank. */
export const RUBIKA_API_DEFAULT = 'https://botapi.rubika.ir/v3';

export type MessengerEgressProvider = 'TELEGRAM' | 'BALE' | 'RUBIKA';

/**
 * Shared HTTPS/HTTP base validation for messenger egress overrides.
 * Trailing slashes stripped. No credentials / query / hash.
 */
export function assertMessengerApiBase(raw: string, errorCode: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(errorCode);
  }
  if (
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new Error(errorCode);
  }
  return parsed.toString().replace(/\/+$/, '');
}

/**
 * Resolve Bot API base per provider.
 * - BALE / RUBIKA: optional `BALE_API_URL` / `RUBIKA_API_URL`, else official defaults.
 * - TELEGRAM: **delegates unchanged** to `telegramApiBase` (TELEGRAM_API_URL). No new TG keys.
 */
export function resolveMessengerApiBase(
  provider: MessengerEgressProvider,
  env: { TELEGRAM_API_URL?: string; BALE_API_URL?: string; RUBIKA_API_URL?: string } = process.env,
): string {
  if (provider === 'TELEGRAM') {
    return telegramApiBase(env);
  }
  if (provider === 'BALE') {
    const raw = String(env.BALE_API_URL ?? '').trim();
    if (!raw) return BALE_API_DEFAULT;
    return assertMessengerApiBase(raw, 'bale_api_url_invalid');
  }
  const raw = String(env.RUBIKA_API_URL ?? '').trim();
  if (!raw) return RUBIKA_API_DEFAULT;
  return assertMessengerApiBase(raw, 'rubika_api_url_invalid');
}

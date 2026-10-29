/** Env-first SMS secrets. Never log or return raw key values. */

export interface ResolvedSmsSecrets {
  apiKey: string;
  linePromo: string;
  lineService: string;
  otpTemplateId: string;
  egressBaseUrl: string;
  egressSecret: string;
  providerMode: 'mock' | 'smsir' | 'disabled';
}

/**
 * Only a positive integer string is a valid sms.ir verify template id.
 * Settings often store Number(0) when unset — treat 0/"0"/NaN/empty as missing
 * so OTP falls back to /send/bulk instead of calling /send/verify with "0".
 */
export function normalizeOtpTemplateId(
  envValue?: string | number | null,
  dbValue?: string | number | null,
): string {
  const candidates = [envValue, dbValue];
  for (const raw of candidates) {
    if (raw === null || raw === undefined) continue;
    const s = String(raw).trim();
    if (!s || s === '0') continue;
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) continue;
    // Keep canonical digit string (reject "12.0", "1e3", etc. via integer check above).
    if (!/^\d+$/.test(s)) continue;
    return s;
  }
  return '';
}

export function resolveSmsSecrets(
  env: NodeJS.ProcessEnv = process.env,
  db?: {
    apiKey?: string;
    lineNumber?: string;
    otpTemplateId?: string | number;
    egressBaseUrl?: string;
    egressSecret?: string;
  } | null,
): ResolvedSmsSecrets {
  const apiKey =
    String(env.SMSIR_API_KEY || '').trim() ||
    String(env.SMS_API_KEY || '').trim() ||
    String(db?.apiKey || '').trim();
  const lineService =
    String(env.SMSIR_LINE_SERVICE || '').trim() ||
    String(env.SMSIR_LINE_NUMBER || '').trim() ||
    String(db?.lineNumber || '').trim() ||
    String(env.SMS_SENDER || '').trim();
  // Never fall back promo→service (or vice versa); missing line fails at send time.
  const linePromo = String(env.SMSIR_LINE_PROMO || '').trim();
  const otpTemplateId = normalizeOtpTemplateId(
    env.SMSIR_OTP_TEMPLATE_ID,
    db?.otpTemplateId,
  );
  const egressBaseUrl =
    String(env.SMS_EGRESS_BASE_URL || '').trim() ||
    String(db?.egressBaseUrl || '').trim();
  const egressSecret =
    String(env.SMS_EGRESS_SECRET || '').trim() ||
    String(db?.egressSecret || '').trim();

  let providerMode: ResolvedSmsSecrets['providerMode'] = 'smsir';
  if (env.NODE_ENV === 'test') providerMode = 'mock';
  else if (String(env.SMS_PROVIDER || '').toLowerCase() === 'mock') providerMode = 'mock';
  else if (!apiKey) providerMode = 'disabled';

  return {
    apiKey,
    linePromo,
    lineService,
    otpTemplateId,
    egressBaseUrl,
    egressSecret,
    providerMode,
  };
}

export function lineForMessageClass(
  messageClass: string,
  secrets: Pick<ResolvedSmsSecrets, 'linePromo' | 'lineService'>,
): { line: string } | { error: 'LINE_NOT_CONFIGURED' } {
  if (messageClass === 'PROMO') {
    if (!secrets.linePromo) return { error: 'LINE_NOT_CONFIGURED' };
    return { line: secrets.linePromo };
  }
  if (!secrets.lineService) return { error: 'LINE_NOT_CONFIGURED' };
  return { line: secrets.lineService };
}

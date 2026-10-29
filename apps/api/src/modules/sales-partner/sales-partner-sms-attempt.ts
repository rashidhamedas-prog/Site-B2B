import type { SmsTransportResult } from '../notification/sms-transport';
import { maskPhone } from './sales-partner-policy';

export type SmsAttemptPurpose = 'otp' | 'credentials' | 'welcome';
export type SmsAttemptResult = 'sent' | 'pending' | 'failed';

export type LastSmsAttempt = {
  at: string;
  purpose: SmsAttemptPurpose;
  result: SmsAttemptResult;
  errorCode?: string;
  errorMessage?: string;
  via?: string;
  durationMs?: number;
  phoneMasked: string;
};

export function buildLastSmsAttempt(
  purpose: SmsAttemptPurpose,
  phone: string,
  delivery: SmsAttemptResult,
  transport: Pick<SmsTransportResult, 'errorCode' | 'errorMessage' | 'via' | 'durationMs'>,
  extra?: { warning?: string },
): LastSmsAttempt {
  const warning = extra?.warning?.trim();
  const baseMessage = transport.errorMessage?.trim();
  const errorMessage =
    warning && baseMessage ? `${warning}; ${baseMessage}` : warning || baseMessage || undefined;
  return {
    at: new Date().toISOString(),
    purpose,
    result: delivery,
    errorCode: transport.errorCode || undefined,
    errorMessage,
    via: transport.via,
    durationMs: transport.durationMs,
    phoneMasked: maskPhone(phone),
  };
}

export function buildCredentialsSmsAttempt(phone: string, sent: boolean): LastSmsAttempt {
  return {
    at: new Date().toISOString(),
    purpose: 'credentials',
    result: sent ? 'sent' : 'failed',
    errorCode: sent ? undefined : 'PROVIDER',
    errorMessage: sent ? undefined : 'ارسال پیامک ناموفق بود',
    phoneMasked: maskPhone(phone),
  };
}

/** Safe audit payload — never include OTP codes or passwords. */
export function auditPayloadForSmsAttempt(attempt: LastSmsAttempt): Record<string, unknown> {
  return {
    purpose: attempt.purpose,
    result: attempt.result,
    phoneMasked: attempt.phoneMasked,
    errorCode: attempt.errorCode,
    errorMessage: attempt.errorMessage,
    via: attempt.via,
    durationMs: attempt.durationMs,
  };
}

export function formatLastSmsAttemptFa(attempt: LastSmsAttempt | null | undefined): string | null {
  if (!attempt) return null;
  const resultLabel =
    attempt.result === 'sent' ? 'موفق' : attempt.result === 'pending' ? 'در انتظار' : 'ناموفق';
  if (attempt.result === 'sent') {
    return `آخرین تلاش ارسال: ${resultLabel}`;
  }
  const reason = attempt.errorMessage || attempt.errorCode || 'نامشخص';
  return `آخرین تلاش ارسال: ${resultLabel} — علت ${reason}`;
}

export type PendingOtpDryRunRow = {
  id: string;
  displayName: string;
  phone: string;
  createdAt: Date | string;
};

/** Read-only preview — no DB writes or SMS side effects. */
export function pendingOtpDryRunPreview(rows: PendingOtpDryRunRow[]) {
  return {
    count: rows.length,
    items: rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      phoneMasked: maskPhone(row.phone),
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    })),
  };
}

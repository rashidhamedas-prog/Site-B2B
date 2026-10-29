/**
 * OTP SMS routing — transactional only.
 * Never routes through marketing consent, quiet hours, or sms-panel bulk approval.
 */

export type OtpSendPath =
  | { path: '/send/verify'; mode: 'transactional'; templateId: number }
  | { path: '/send/bulk'; mode: 'service_line_fallback'; lineNumber: string; warning: string }
  | { path: null; mode: 'unavailable'; errorMessage: string };

export const OTP_TEMPLATE_MISSING_WARNING =
  'otpTemplateId missing — OTP using transactional service-line text fallback; configure sms.ir verify template';

export function chooseOtpSendPath(input: {
  otpTemplateId?: number | string | null;
  lineService?: string | null;
}): OtpSendPath {
  const templateId = Number(input.otpTemplateId) || 0;
  if (templateId > 0) {
    return { path: '/send/verify', mode: 'transactional', templateId };
  }
  const line = String(input.lineService || '').trim();
  if (line) {
    return {
      path: '/send/bulk',
      mode: 'service_line_fallback',
      lineNumber: line,
      warning: OTP_TEMPLATE_MISSING_WARNING,
    };
  }
  return {
    path: null,
    mode: 'unavailable',
    errorMessage: 'otpTemplateId and lineService missing — cannot send transactional OTP',
  };
}

/** Guard for unit tests: OTP never invents a promo/consent mode. */
export function otpPathIsTransactional(path: OtpSendPath): boolean {
  return (
    path.mode === 'transactional' ||
    path.mode === 'service_line_fallback' ||
    path.mode === 'unavailable'
  );
}

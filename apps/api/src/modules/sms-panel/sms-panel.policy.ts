import type { SmsMessageClass } from './domain/template';
import { SMS_MANAGERS } from './sms-roles';

export type SendGateDeny = {
  kind: 'FORBIDDEN' | 'BAD_REQUEST';
  code: string;
};

/** Pure send-single role/class matrix (mirrors SmsPanelService.sendSingle guards). */
export function checkSendSingleAllowed(
  actorRole: string,
  messageClass: SmsMessageClass,
  opts?: { templateId?: string; body?: string },
): SendGateDeny | null {
  if (actorRole === 'SMS_MARKETER' && messageClass !== 'PROMO') {
    return { kind: 'FORBIDDEN', code: 'SMS_FORBIDDEN' };
  }
  if (actorRole === 'SMS_OPERATOR') {
    if (messageClass === 'PROMO' || messageClass === 'OTP') {
      return { kind: 'FORBIDDEN', code: 'SMS_FORBIDDEN' };
    }
    if (messageClass === 'TRANSACTIONAL' && (!opts?.templateId || opts?.body)) {
      return { kind: 'BAD_REQUEST', code: 'SMS_TEMPLATE_REQUIRED' };
    }
  }
  if (messageClass === 'OTP') {
    if (!(SMS_MANAGERS as readonly string[]).includes(actorRole)) {
      return { kind: 'FORBIDDEN', code: 'SMS_FORBIDDEN' };
    }
    if (opts?.body && !opts?.templateId) {
      return { kind: 'BAD_REQUEST', code: 'SMS_OTP_TEMPLATE_REQUIRED' };
    }
  }
  return null;
}

export function assertSendAllowed(
  actorRole: string,
  messageClass: SmsMessageClass,
  opts?: { templateId?: string; body?: string },
): void {
  const deny = checkSendSingleAllowed(actorRole, messageClass, opts);
  if (deny) {
    throw new Error(`${deny.kind}:${deny.code}`);
  }
}

/** Four-eyes: creator cannot approve their own campaign. */
export function checkFourEyesApproval(
  approverId: string,
  createdBy: string | null | undefined,
): SendGateDeny | null {
  if (createdBy && createdBy === approverId) {
    return { kind: 'FORBIDDEN', code: 'SMS_FOUR_EYES' };
  }
  return null;
}

/** Dispatch must not blind-resend when delivery outcome is unknown. */
export function blocksDispatchResend(messageStatus: string): boolean {
  return messageStatus === 'PENDING_UNKNOWN';
}

export const DISPATCH_CLAIMABLE_STATUSES = ['QUEUED', 'SENDING'] as const;

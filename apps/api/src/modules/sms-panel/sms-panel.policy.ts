import type { SmsMessageClass } from './domain/template';
import type { SmsPanelSettings } from './sms-panel.settings';
import { SMS_ALL, SMS_MANAGERS, SMS_MARKETERS, SMS_SEND_SINGLE } from './sms-roles';

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

/** Explicit route matrix. Reflection test requires every controller handler to match. */
export const SMS_ROUTE_ROLES = {
  audienceSources: SMS_ALL,
  audienceContacts: SMS_ALL,
  audienceContact: SMS_ALL,
  credit: SMS_ALL,
  send: SMS_SEND_SINGLE,
  templates: SMS_ALL,
  createTemplate: SMS_MANAGERS,
  updateTemplate: SMS_MANAGERS,
  previewTemplate: SMS_ALL,
  lists: SMS_MARKETERS,
  createList: SMS_MARKETERS,
  importList: SMS_MARKETERS,
  members: SMS_MARKETERS,
  audienceFields: SMS_MARKETERS,
  segmentPreview: SMS_MARKETERS,
  segmentList: SMS_MARKETERS,
  segmentCreate: SMS_MARKETERS,
  segmentUpdate: SMS_MARKETERS,
  segmentDelete: SMS_MARKETERS,
  campaigns: SMS_MARKETERS,
  createCampaign: SMS_MARKETERS,
  campaign: SMS_MARKETERS,
  previewCampaign: SMS_MARKETERS,
  prepare: SMS_MARKETERS,
  confirm: SMS_MARKETERS,
  approve: SMS_MANAGERS,
  canary: SMS_MARKETERS,
  pause: SMS_MARKETERS,
  resume: SMS_MARKETERS,
  cancel: SMS_MARKETERS,
  messages: SMS_ALL,
  message: SMS_ALL,
  reports: SMS_ALL,
  exportCsv: SMS_ALL,
  blacklist: SMS_MANAGERS,
  addBlacklist: SMS_MANAGERS,
  delBlacklist: SMS_MANAGERS,
  importBlacklist: SMS_MANAGERS,
  unsubscribes: SMS_MANAGERS,
  addUnsub: SMS_MANAGERS,
  delUnsub: SMS_MANAGERS,
  audit: SMS_MANAGERS,
  getSettings: SMS_MANAGERS,
  patchSettings: SMS_MANAGERS,
  probe: SMS_MANAGERS,
} as const;

export type SmsRouteName = keyof typeof SMS_ROUTE_ROLES;

const PANEL_ROLES = new Set<string>(SMS_ALL);

export function roleAllowsSmsRoute(role: string, route: SmsRouteName): boolean {
  if (!PANEL_ROLES.has(role)) return false;
  return (SMS_ROUTE_ROLES[route] as readonly string[]).includes(role);
}

export const AUDIENCE_LOOKUP_LIMIT = 30;

export function audienceLookupRetryAfter(
  count: number,
  limit = AUDIENCE_LOOKUP_LIMIT,
  windowSec = 60,
): number | null {
  return count > limit ? windowSec : null;
}

/** Before/after settings audit without phone numbers. */
export function settingsAuditSnapshot(settings: SmsPanelSettings) {
  return {
    promoWindowStart: settings.promoWindowStart,
    promoWindowEnd: settings.promoWindowEnd,
    promoPerDay: settings.promoPerDay,
    promoPerWeek: settings.promoPerWeek,
    creditWarnThreshold: settings.creditWarnThreshold,
    otpCooldownSeconds: settings.otpCooldownSeconds,
    unitPricePerPart: settings.unitPricePerPart,
    testNumberCount: settings.testNumbers.length,
  };
}

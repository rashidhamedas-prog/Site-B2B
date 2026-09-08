import { inQuietHours, nextQuietEnd, tehranHour } from '../../lib/tehran-time';
import type { ConsentStatus, MarketingMode, MessageClass } from './customer-marketing.constants';
import { decideConsent } from './consent-policy';

export type SendGate =
  | { allow: true; recipientOverride?: string }
  | { allow: false; reason: 'MODE_OFF' | 'DISABLED' | 'PREVIEW' | 'QUIET_HOURS' | 'CAP_EXCEEDED' | 'TEMPLATE_MISSING' | 'NO_PHONE'; deferUntil?: Date };

export function evaluateSendGate(input: {
  enabled: boolean;
  mode: MarketingMode;
  messageClass: MessageClass;
  now: Date;
  quietStartHour: number | null;
  quietEndHour: number | null;
  sentNurtureToday: number;
  sentPromoToday: number;
  nurtureCap: number;
  promoCap: number;
  lastPromoAt: Date | null;
  promoMinGapHours: number;
  channelSentToday: number;
  dailyCapPerChannel: number;
  hasTemplate: boolean;
  hasPhone: boolean;
  canaryPhone?: string;
}): SendGate {
  if (!input.enabled) return { allow: false, reason: 'DISABLED' };
  if (input.mode === 'OFF') return { allow: false, reason: 'MODE_OFF' };
  if (!input.hasTemplate) return { allow: false, reason: 'TEMPLATE_MISSING' };
  if (!input.hasPhone && input.mode !== 'PREVIEW' && input.mode !== 'CANARY') {
    return { allow: false, reason: 'NO_PHONE' };
  }
  if (input.mode === 'PREVIEW') return { allow: false, reason: 'PREVIEW' };
  if (input.channelSentToday >= input.dailyCapPerChannel) return { allow: false, reason: 'CAP_EXCEEDED' };
  if (input.messageClass === 'NURTURE' && input.sentNurtureToday >= input.nurtureCap) {
    return { allow: false, reason: 'CAP_EXCEEDED' };
  }
  if (input.messageClass === 'PROMO') {
    if (input.sentPromoToday >= input.promoCap) return { allow: false, reason: 'CAP_EXCEEDED' };
    if (input.lastPromoAt && input.promoMinGapHours > 0) {
      const gapEnd = input.lastPromoAt.getTime() + input.promoMinGapHours * 3600_000;
      if (gapEnd > input.now.getTime()) return { allow: false, reason: 'CAP_EXCEEDED' };
    }
  }
  if (inQuietHours(tehranHour(input.now), input.quietStartHour, input.quietEndHour) && input.quietEndHour != null) {
    return { allow: false, reason: 'QUIET_HOURS', deferUntil: nextQuietEnd(input.now, input.quietEndHour) };
  }
  if (input.mode === 'CANARY') {
    if (!input.canaryPhone) return { allow: false, reason: 'NO_PHONE' };
    return { allow: true, recipientOverride: input.canaryPhone };
  }
  return { allow: true };
}

export type DeliveryRecheck =
  | { allow: true }
  | { allow: false; status: 'SKIPPED' | 'SUPPRESSED'; reason: string };

/** Re-evaluate kill switch + consent at worker delivery time (queued rows can go stale). */
export function recheckDelivery(input: {
  enabled: boolean;
  globalMode: MarketingMode;
  rowMode: MarketingMode;
  messageClass: MessageClass;
  hasCustomerId: boolean;
  consent: ConsentStatus | null;
  suppressed: boolean;
  treatRegisterAutoAsPromoConsent: boolean;
}): DeliveryRecheck {
  const messageClass: MessageClass = input.messageClass === 'PROMO' ? 'PROMO' : 'NURTURE';
  const globalLive = input.globalMode === 'CANARY' || input.globalMode === 'LIVE';
  const rowLive = input.rowMode === 'CANARY' || input.rowMode === 'LIVE';
  if (!input.enabled || !globalLive || !rowLive || (input.rowMode === 'LIVE' && input.globalMode !== 'LIVE')) {
    return { allow: false, status: 'SKIPPED', reason: !input.enabled ? 'DISABLED' : 'MODE_OFF' };
  }
  if (input.hasCustomerId) {
    const decision = decideConsent({
      messageClass,
      consent: input.consent,
      suppressed: input.suppressed,
      treatRegisterAutoAsPromoConsent: input.treatRegisterAutoAsPromoConsent,
    });
    if (!decision.allow) {
      const reason = 'reason' in decision ? decision.reason : 'NO_CONSENT';
      return { allow: false, status: 'SUPPRESSED', reason };
    }
  } else if (input.suppressed) {
    return { allow: false, status: 'SUPPRESSED', reason: 'SUPPRESSED' };
  }
  return { allow: true };
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return String(template || '')
    .replace(/\{(\w+)\}/g, (_, key: string) => (vars[key] != null && vars[key] !== '' ? String(vars[key]) : ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

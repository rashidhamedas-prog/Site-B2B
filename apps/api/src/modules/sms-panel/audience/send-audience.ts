import { nextPromoWindowOpen, isWithinPromoWindow, type PromoWindow } from '../domain/quiet-hours';
import { SMS_MANAGERS } from '../sms-roles';

export type SendDecision =
  | { ok: true; offlist: boolean }
  | { ok: false; http: number; code: string };

export type AudienceGateContact = {
  promoConsent: boolean;
  optedOut: boolean;
  blacklisted: boolean;
  sources: string[];
};

const MANAGERS = new Set<string>(SMS_MANAGERS);

/** Off-list numbers: only ADMIN and SMS_MANAGER, and only TRANSACTIONAL or PROMO. */
export function checkOfflistSend(role: string, messageClass: string): SendDecision | null {
  if (MANAGERS.has(role) && (messageClass === 'TRANSACTIONAL' || messageClass === 'PROMO')) {
    return null;
  }
  return { ok: false, http: 403, code: 'SMS_OFFLIST_FORBIDDEN' };
}

/**
 * Single send after the audience lookup.
 * `contact === null` means the phone is outside every source.
 */
export function decideSingleSend(input: {
  role: string;
  messageClass: string;
  contact: AudienceGateContact | null;
  withinWindow: boolean;
}): SendDecision {
  if (!input.contact) {
    const offlist = checkOfflistSend(input.role, input.messageClass);
    if (offlist) return offlist;
    if (input.messageClass === 'PROMO' && !input.withinWindow) {
      return { ok: false, http: 422, code: 'SMS_QUIET_HOURS' };
    }
    return { ok: true, offlist: true };
  }
  if (input.role === 'SMS_OPERATOR' && input.messageClass === 'PROMO') {
    return { ok: false, http: 403, code: 'SMS_FORBIDDEN' };
  }
  if (input.role === 'SMS_MARKETER' && input.messageClass === 'TRANSACTIONAL') {
    return { ok: false, http: 403, code: 'SMS_FORBIDDEN' };
  }
  if (input.contact.blacklisted) return { ok: false, http: 400, code: 'SMS_BLACKLISTED' };
  if (input.contact.optedOut && input.messageClass !== 'OTP') {
    return { ok: false, http: 400, code: 'SMS_UNSUBSCRIBED' };
  }
  if (input.messageClass === 'PROMO' && !input.contact.promoConsent) {
    return { ok: false, http: 403, code: 'SMS_NO_CONSENT' };
  }
  if (input.messageClass === 'PROMO' && !input.withinWindow) {
    return { ok: false, http: 422, code: 'SMS_QUIET_HOURS' };
  }
  return { ok: true, offlist: false };
}

/** Every bulk campaign needs a second approver. No recipient threshold. */
export function bulkNeedsSecondApproval(_recipientCount?: number): boolean {
  return true;
}

export function approverIsCreator(approverId: string, createdBy: string | null | undefined): boolean {
  return !!createdBy && createdBy === approverId;
}

export function scheduleOutsideWindow(
  scheduledAt: Date,
  window: PromoWindow,
): { nextAllowedAt: string | null } | null {
  if (isWithinPromoWindow(scheduledAt, window)) return null;
  const next = nextPromoWindowOpen(scheduledAt, window);
  return { nextAllowedAt: next ? next.toISOString() : null };
}

/** Move a send that would start after the window closes into the next open window. */
export function deferIfOutsideWindow(when: Date, window: PromoWindow): Date {
  if (isWithinPromoWindow(when, window)) return when;
  return nextPromoWindowOpen(when, window) || when;
}

export function snapshotPhones(phones: string[]): string[] {
  return [...new Set(phones.filter(Boolean))].sort();
}

export function snapshotContains(snapshot: readonly string[], phone: string): boolean {
  return snapshot.includes(phone);
}

export function canEditUnitPrice(role: string): boolean {
  return MANAGERS.has(role);
}

/** Null stays null. Never invent a rial default. */
export function readStoredUnitPrice(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null;
  return Math.floor(raw);
}

export function priceCaption(unitPricePerPart: number | null): string {
  if (unitPricePerPart == null) return 'قیمت تنظیم نشده';
  return `${Math.floor(unitPricePerPart).toLocaleString('fa-IR')} ریال`;
}

export type UnitPricePatchDecision =
  | { ok: true; value: number | null }
  | { ok: false; http: 403 | 400; code: string; message: string };

/**
 * PATCH unitPricePerPart: managers only; empty/null clears; negatives rejected.
 * Call only when the key is present on the patch body.
 */
export function decideUnitPricePatch(
  role: string | undefined,
  raw: unknown,
): UnitPricePatchDecision {
  if (role != null && !canEditUnitPrice(role)) {
    return {
      ok: false,
      http: 403,
      code: 'SMS_FORBIDDEN',
      message: 'تغییر قیمت واحد فقط برای مدیر پیامک و مدیر کل مجاز است',
    };
  }
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return {
      ok: false,
      http: 400,
      code: 'SMS_INVALID_UNIT_PRICE',
      message: 'قیمت هر پارت باید عدد نامنفی باشد',
    };
  }
  return { ok: true, value: Math.floor(raw) };
}

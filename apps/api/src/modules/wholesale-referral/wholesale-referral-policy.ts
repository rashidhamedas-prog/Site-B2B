import { normalizePhone } from '../auth/phone.util';

/** Lead-introduction program. Partners do not price, close, collect, or ship. */

export const WHOLESALE_REFERRAL_SETTINGS_KEY = 'wholesaleReferral';
export const REFERRAL_COOKIE = 'wr_code';
export const DRAFT_TERMS_VERSION = 'draft-unreviewed';

export const REFERRAL_CRM_ROLES = ['ADMIN', 'SALES_MANAGER', 'SALES_REP', 'CUSTOMER_SERVICE'] as const;
export const REFERRAL_FINANCE_ROLES = ['ADMIN', 'ACCOUNTANT'] as const;
export const REFERRAL_OWNERSHIP_OVERRIDE_ROLES = ['ADMIN', 'SALES_MANAGER'] as const;

export const PARTNER_STAGES = [
  'SUBMITTED',
  'NEEDS_INFORMATION',
  'UNDER_REVIEW',
  'SALES_FOLLOW_UP',
  'ACCOUNT_APPROVED',
  'FIRST_ORDER_PENDING',
  'REWARD_ESTIMATED',
  'REWARD_HELD',
  'REWARD_AVAILABLE',
  'REWARD_PAID',
  'REJECTED',
  'DISPUTED',
] as const;

export type PartnerStage = (typeof PARTNER_STAGES)[number];

export const PARTNER_STAGE_LABEL: Record<PartnerStage, string> = {
  SUBMITTED: 'ثبت شد',
  NEEDS_INFORMATION: 'نیاز به اطلاعات',
  UNDER_REVIEW: 'در حال بررسی',
  SALES_FOLLOW_UP: 'پیگیری فروش',
  ACCOUNT_APPROVED: 'حساب عمده تأیید شد',
  FIRST_ORDER_PENDING: 'در انتظار اولین سفارش',
  REWARD_ESTIMATED: 'پاداش برآوردی',
  REWARD_HELD: 'پاداش در دوره نگهداری',
  REWARD_AVAILABLE: 'پاداش قابل پرداخت',
  REWARD_PAID: 'پاداش پرداخت‌شده',
  REJECTED: 'پذیرفته نشد',
  DISPUTED: 'در حال بررسی اختلاف',
};

export const MANUAL_FRESHNESS_NOTE =
  'به‌روزرسانی‌ها بعد از ثبت توسط تیم فروش دیده می‌شوند و لحظه‌ای نیستند.';

const REASON_REQUIRED = new Set<PartnerStage>([
  'NEEDS_INFORMATION',
  'REJECTED',
  'REWARD_HELD',
  'DISPUTED',
]);

export const PARTNER_REASON_FA: Record<string, string> = {
  DUPLICATE_BOUTIQUE: 'این بوتیک قبلاً در برنامه ثبت شده است.',
  NOT_ELIGIBLE: 'این معرفی با معیارهای فعلی همکاری جور نبود.',
  NO_RESPONSE: 'تیم فروش هنوز پاسخی از بوتیک نگرفته است.',
  HOLD_PERIOD: 'پاداش در دورهٔ نگهداری است و هنوز قابل پرداخت نیست.',
  SELF_REFERRAL: 'معرفی فروشگاه خودتان در این برنامه پذیرفته نمی‌شود.',
  PREEXISTING_CUSTOMER: 'این بوتیک از قبل مشتری ترنم بوده است.',
  OWNERSHIP_CONFLICT: 'مالکیت این معرفی نیاز به بررسی انسان دارد و معرفی معتبر دیگری جایگزین نشده است.',
  OWNERSHIP_EXPIRED: 'مهلت مالکیت این معرفی به پایان رسیده است.',
  OUTSIDE_POLICY: 'این معرفی خارج از قواعد تأییدشدهٔ برنامه است.',
  INCOMPLETE_APPLICATION: 'اطلاعات این معرفی هنوز کامل نیست.',
  ORDER_NOT_QUALIFYING: 'هنوز سفارش عمدهٔ واجد شرایطی ثبت نشده است.',
  RETURN_OR_REFUND: 'به‌خاطر مرجوعی یا بازپرداخت، پاداش اصلاح شد.',
  PAYMENT_REVERSED: 'پرداخت این سفارش برگشت خورده است.',
  AWAITING_POLICY: 'معرفی ثبت شد. تا وقتی قواعد برنامه تأیید نشود، مالکیت قطعی نمی‌شود.',
  OTHER: 'توضیح تیم فروش در پیام زیر است.',
};

export const FUNNEL_STEPS = [
  'partner_application',
  'partner_approval',
  'unique_introduction',
  'accepted_introduction',
  'boutique_approval',
  'first_paid_qualifying_order',
  'reward_available',
  'reward_paid',
] as const;

export type WholesaleReferralMode = 'OFF' | 'PREVIEW' | 'CANARY' | 'LIVE';

export type WholesaleReferralSettings = {
  enabled: boolean;
  mode: WholesaleReferralMode;
  applyOpen: boolean;
  termsVersion: string;
  termsBody: string;
  pilotPhones: string[];
  rewardKind: 'RATE_BPS' | 'FIXED' | null;
  rewardRateBps: number | null;
  rewardFixedAmount: number | null;
  rewardCap: number | null;
  ownershipWindowDays: number | null;
  holdDays: number | null;
  minPayout: number | null;
  payoutSchedule: string | null;
  salesResponseTargetHours: number | null;
  boutiqueEligibilityNote: string | null;
  repeatOrderRewards: false;
  marketDevelopmentTier: false;
};

export const DEFAULT_WHOLESALE_REFERRAL_SETTINGS: WholesaleReferralSettings = {
  enabled: false,
  mode: 'OFF',
  applyOpen: false,
  termsVersion: DRAFT_TERMS_VERSION,
  termsBody: '',
  pilotPhones: [],
  rewardKind: null,
  rewardRateBps: null,
  rewardFixedAmount: null,
  rewardCap: null,
  ownershipWindowDays: null,
  holdDays: null,
  minPayout: null,
  payoutSchedule: null,
  salesResponseTargetHours: null,
  boutiqueEligibilityNote: null,
  repeatOrderRewards: false,
  marketDevelopmentTier: false,
};

const LAUNCH_FIELD_LABEL: Record<string, string> = {
  terms: 'متن و نسخهٔ تأییدشدهٔ شرایط',
  reward: 'نرخ یا مبلغ ثابت پاداش',
  rewardCap: 'سقف پاداش',
  ownershipWindowDays: 'پنجرهٔ مالکیت معرفی',
  holdDays: 'دورهٔ نگهداری پاداش',
  minPayout: 'حداقل پرداخت',
  payoutSchedule: 'زمان‌بندی پرداخت',
  salesResponseTargetHours: 'هدف پاسخ تیم فروش',
  boutiqueEligibilityNote: 'معیار بوتیک مناسب',
};

export function missingLaunchFields(settings: WholesaleReferralSettings): string[] {
  const missing: string[] = [];
  const termsReady =
    settings.termsVersion.trim() !== '' &&
    settings.termsVersion !== DRAFT_TERMS_VERSION &&
    settings.termsBody.trim() !== '';
  if (!termsReady) missing.push('terms');
  const rewardReady =
    (settings.rewardKind === 'RATE_BPS' && settings.rewardRateBps != null && settings.rewardRateBps >= 0) ||
    (settings.rewardKind === 'FIXED' && settings.rewardFixedAmount != null && settings.rewardFixedAmount >= 0);
  if (!rewardReady) missing.push('reward');
  if (settings.rewardCap == null || settings.rewardCap < 0) missing.push('rewardCap');
  if (settings.ownershipWindowDays == null || settings.ownershipWindowDays <= 0) missing.push('ownershipWindowDays');
  if (settings.holdDays == null || settings.holdDays < 0) missing.push('holdDays');
  if (settings.minPayout == null || settings.minPayout < 0) missing.push('minPayout');
  if (!settings.payoutSchedule?.trim()) missing.push('payoutSchedule');
  if (settings.salesResponseTargetHours == null || settings.salesResponseTargetHours <= 0) {
    missing.push('salesResponseTargetHours');
  }
  if (!settings.boutiqueEligibilityNote?.trim()) missing.push('boutiqueEligibilityNote');
  return missing;
}

export function launchFieldLabels(fields: string[]): string[] {
  return fields.map((field) => LAUNCH_FIELD_LABEL[field] || field);
}

function asMode(value: unknown): WholesaleReferralMode {
  if (value === 'PREVIEW' || value === 'CANARY' || value === 'LIVE' || value === 'OFF') return value;
  return 'OFF';
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asPhones(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeIranMobile(String(item)))
    .filter((phone): phone is string => !!phone);
}

export function resolveWholesaleReferralSettings(raw: unknown): WholesaleReferralSettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rewardKind = source.rewardKind === 'RATE_BPS' || source.rewardKind === 'FIXED' ? source.rewardKind : null;
  return {
    enabled: source.enabled === true,
    mode: asMode(source.mode),
    applyOpen: source.applyOpen === true,
    termsVersion: typeof source.termsVersion === 'string' && source.termsVersion.trim()
      ? source.termsVersion.trim()
      : DRAFT_TERMS_VERSION,
    termsBody: typeof source.termsBody === 'string' ? source.termsBody : '',
    pilotPhones: asPhones(source.pilotPhones),
    rewardKind,
    rewardRateBps: asNumber(source.rewardRateBps),
    rewardFixedAmount: asNumber(source.rewardFixedAmount),
    rewardCap: asNumber(source.rewardCap),
    ownershipWindowDays: asNumber(source.ownershipWindowDays),
    holdDays: asNumber(source.holdDays),
    minPayout: asNumber(source.minPayout),
    payoutSchedule: typeof source.payoutSchedule === 'string' && source.payoutSchedule.trim()
      ? source.payoutSchedule.trim()
      : null,
    salesResponseTargetHours: asNumber(source.salesResponseTargetHours),
    boutiqueEligibilityNote:
      typeof source.boutiqueEligibilityNote === 'string' && source.boutiqueEligibilityNote.trim()
        ? source.boutiqueEligibilityNote.trim()
        : null,
    repeatOrderRewards: false,
    marketDevelopmentTier: false,
  };
}

export function programReady(settings: WholesaleReferralSettings): boolean {
  if (!settings.enabled) return false;
  if (settings.mode !== 'CANARY' && settings.mode !== 'LIVE') return false;
  if (settings.repeatOrderRewards || settings.marketDevelopmentTier) return false;
  return missingLaunchFields(settings).length === 0;
}

export function phoneInPilot(settings: WholesaleReferralSettings, phone: string): boolean {
  const normalized = normalizeIranMobile(phone);
  if (!normalized) return false;
  return settings.pilotPhones.includes(normalized);
}

export function programAllowsApply(settings: WholesaleReferralSettings, phone: string): boolean {
  if (!programReady(settings) || !settings.applyOpen) return false;
  if (settings.mode === 'LIVE') return true;
  return settings.mode === 'CANARY' && phoneInPilot(settings, phone);
}

export function programCanLockOwnership(settings: WholesaleReferralSettings, partnerPhone: string): boolean {
  if (!programReady(settings)) return false;
  if (settings.mode === 'LIVE') return true;
  return settings.mode === 'CANARY' && phoneInPilot(settings, partnerPhone);
}

export function normalizeIranMobile(raw: string): string | null {
  const phone = normalizePhone(raw);
  return /^09[0-9]{9}$/.test(phone) ? phone : null;
}

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = String(raw || '').trim().toLowerCase();
  return /^[a-z0-9]{8}$/.test(code) ? code : null;
}

export function readReferralCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === REFERRAL_COOKIE) return normalizeReferralCode(decodeURIComponent(rest.join('=')));
  }
  return null;
}

export type OwnershipStatus = 'AWAITING_POLICY' | 'OWNED' | 'EXPIRED' | 'CONFLICT' | 'REJECTED';

export type IntroRecord = {
  id: string;
  partnerId: string;
  normalizedPhone: string;
  customerId: string | null;
  ownershipStatus: OwnershipStatus;
  reasonCode: string | null;
  expiresAt: string | null;
  stage: PartnerStage;
};

export type OwnershipAttempt = {
  newId: string;
  partnerId: string;
  partnerPhone: string;
  boutiquePhone: string;
  customerId: string | null;
  customerPreexistingActive: boolean;
  referralCodeValid: boolean;
  now: string;
  windowDays: number | null;
  programCanLock: boolean;
};

export type OwnershipDecision = 'LOCKED' | 'IDEMPOTENT' | 'CONFLICT' | 'REJECTED' | 'RECORDED_PENDING' | 'IGNORED';

export type OwnershipCommit = {
  decision: OwnershipDecision;
  reasonCode: string | null;
  records: IntroRecord[];
  changedId: string | null;
};

function cloneRecords(records: IntroRecord[]): IntroRecord[] {
  return records.map((row) => ({ ...row }));
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function activeOwned(records: IntroRecord[], phone: string, now: string): IntroRecord | undefined {
  return records.find(
    (row) =>
      row.normalizedPhone === phone &&
      row.ownershipStatus === 'OWNED' &&
      !!row.expiresAt &&
      row.expiresAt > now,
  );
}

function expireStale(records: IntroRecord[], phone: string, now: string): IntroRecord[] {
  return records.map((row) => {
    if (row.normalizedPhone !== phone || row.ownershipStatus !== 'OWNED' || !row.expiresAt) return row;
    if (row.expiresAt > now) return row;
    return { ...row, ownershipStatus: 'EXPIRED', reasonCode: 'OWNERSHIP_EXPIRED', stage: 'REJECTED' };
  });
}

export function commitOwnership(state: IntroRecord[], attempt: OwnershipAttempt): OwnershipCommit {
  const boutiquePhone = normalizeIranMobile(attempt.boutiquePhone);
  const partnerPhone = normalizeIranMobile(attempt.partnerPhone);
  if (!attempt.referralCodeValid || !boutiquePhone || !partnerPhone) {
    return { decision: 'IGNORED', reasonCode: null, records: cloneRecords(state), changedId: null };
  }

  if (partnerPhone === boutiquePhone) {
    const row: IntroRecord = {
      id: attempt.newId,
      partnerId: attempt.partnerId,
      normalizedPhone: boutiquePhone,
      customerId: attempt.customerId,
      ownershipStatus: 'REJECTED',
      reasonCode: 'SELF_REFERRAL',
      expiresAt: null,
      stage: 'REJECTED',
    };
    return { decision: 'REJECTED', reasonCode: 'SELF_REFERRAL', records: [...cloneRecords(state), row], changedId: row.id };
  }

  if (attempt.customerPreexistingActive) {
    const row: IntroRecord = {
      id: attempt.newId,
      partnerId: attempt.partnerId,
      normalizedPhone: boutiquePhone,
      customerId: attempt.customerId,
      ownershipStatus: 'CONFLICT',
      reasonCode: 'PREEXISTING_CUSTOMER',
      expiresAt: null,
      stage: 'UNDER_REVIEW',
    };
    return {
      decision: 'CONFLICT',
      reasonCode: 'PREEXISTING_CUSTOMER',
      records: [...cloneRecords(state), row],
      changedId: row.id,
    };
  }

  const expired = expireStale(cloneRecords(state), boutiquePhone, attempt.now);
  const owned = activeOwned(expired, boutiquePhone, attempt.now);
  if (owned && owned.partnerId === attempt.partnerId) {
    const records = expired.map((row) =>
      row.id === owned.id
        ? { ...row, customerId: row.customerId || attempt.customerId }
        : row,
    );
    return { decision: 'IDEMPOTENT', reasonCode: null, records, changedId: owned.id };
  }
  if (owned && owned.partnerId !== attempt.partnerId) {
    const row: IntroRecord = {
      id: attempt.newId,
      partnerId: attempt.partnerId,
      normalizedPhone: boutiquePhone,
      customerId: attempt.customerId,
      ownershipStatus: 'CONFLICT',
      reasonCode: 'OWNERSHIP_CONFLICT',
      expiresAt: null,
      stage: 'UNDER_REVIEW',
    };
    return { decision: 'CONFLICT', reasonCode: 'OWNERSHIP_CONFLICT', records: [...expired, row], changedId: row.id };
  }

  const samePending = expired.find(
    (row) =>
      row.partnerId === attempt.partnerId &&
      row.normalizedPhone === boutiquePhone &&
      (row.ownershipStatus === 'AWAITING_POLICY' || row.ownershipStatus === 'OWNED'),
  );

  if (!attempt.programCanLock || attempt.windowDays == null || attempt.windowDays <= 0) {
    if (samePending) {
      const records = expired.map((row) =>
        row.id === samePending.id ? { ...row, customerId: row.customerId || attempt.customerId } : row,
      );
      return { decision: 'IDEMPOTENT', reasonCode: 'AWAITING_POLICY', records, changedId: samePending.id };
    }
    const row: IntroRecord = {
      id: attempt.newId,
      partnerId: attempt.partnerId,
      normalizedPhone: boutiquePhone,
      customerId: attempt.customerId,
      ownershipStatus: 'AWAITING_POLICY',
      reasonCode: 'AWAITING_POLICY',
      expiresAt: null,
      stage: 'SUBMITTED',
    };
    return { decision: 'RECORDED_PENDING', reasonCode: 'AWAITING_POLICY', records: [...expired, row], changedId: row.id };
  }

  const expiresAt = addDays(attempt.now, attempt.windowDays);
  const records = expired.map((row) => {
    if (row.normalizedPhone !== boutiquePhone || row.partnerId === attempt.partnerId) return row;
    if (row.ownershipStatus === 'REJECTED' || row.ownershipStatus === 'EXPIRED') return row;
    return { ...row, ownershipStatus: 'CONFLICT' as const, reasonCode: 'OWNERSHIP_CONFLICT', stage: 'UNDER_REVIEW' as const };
  });
  if (samePending) {
    const next = records.map((row) =>
      row.id === samePending.id
        ? {
            ...row,
            customerId: row.customerId || attempt.customerId,
            ownershipStatus: 'OWNED' as const,
            reasonCode: null,
            expiresAt,
            stage: 'SUBMITTED' as const,
          }
        : row,
    );
    return { decision: 'LOCKED', reasonCode: null, records: next, changedId: samePending.id };
  }
  const row: IntroRecord = {
    id: attempt.newId,
    partnerId: attempt.partnerId,
    normalizedPhone: boutiquePhone,
    customerId: attempt.customerId,
    ownershipStatus: 'OWNED',
    reasonCode: null,
    expiresAt,
    stage: 'SUBMITTED',
  };
  return { decision: 'LOCKED', reasonCode: null, records: [...records, row], changedId: row.id };
}

export function validateManualIntroduction(consentToShareContact: boolean): { ok: true } | { ok: false; error: string } {
  if (consentToShareContact !== true) {
    return { ok: false, error: 'بدون اجازهٔ صریح بوتیک برای اشتراک تماس، معرفی دستی ثبت نمی‌شود.' };
  }
  return { ok: true };
}

export function validateStatusChange(input: {
  toStatus: string;
  reasonCode?: string | null;
  partnerExplanation?: string | null;
  internalNote?: string | null;
}): { ok: true; partnerExplanation: string; internalNote: string | null } | { ok: false; error: string } {
  if (!(PARTNER_STAGES as readonly string[]).includes(input.toStatus)) {
    return { ok: false, error: 'وضعیت نامعتبر است.' };
  }
  const stage = input.toStatus as PartnerStage;
  const reason = input.reasonCode?.trim() || '';
  if (REASON_REQUIRED.has(stage) && !reason) {
    return { ok: false, error: 'برای این وضعیت کد دلیل لازم است.' };
  }
  if (reason === 'OTHER' && !input.partnerExplanation?.trim()) {
    return { ok: false, error: 'برای دلیل «سایر» توضیح قابل‌نمایش برای همکار لازم است.' };
  }
  const partnerExplanation =
    input.partnerExplanation?.trim() ||
    (reason ? PARTNER_REASON_FA[reason] : '') ||
    PARTNER_STAGE_LABEL[stage];
  return {
    ok: true,
    partnerExplanation,
    internalNote: input.internalNote?.trim() ? input.internalNote.trim() : null,
  };
}

export type RewardBucket = 'estimated' | 'held' | 'available' | 'paid' | 'reversed' | 'disputed';

export const REWARD_BUCKET_LABEL: Record<RewardBucket, string> = {
  estimated: 'برآوردی',
  held: 'در نگهداری',
  available: 'قابل پرداخت',
  paid: 'پرداخت‌شده',
  reversed: 'برگشت‌خورده',
  disputed: 'مورد اختلاف',
};

export const REWARD_BUCKET_DEFINITION: Record<RewardBucket, string> = {
  estimated: 'برآورد اولیه بعد از اولین سفارش عمدهٔ پرداخت‌شده. هنوز قابل دریافت نیست.',
  held: 'مبلغی که دورهٔ نگهداری‌اش تمام نشده یا فروش هنوز آن را آزاد نکرده است.',
  available: 'مبلغی که طبق قاعدهٔ ثبت‌شده قابل درخواست پرداخت است. واریز بانکی جدا ثبت می‌شود.',
  paid: 'مبلغی که ترنم پرداختش را ثبت کرده است. این عدد به‌تنهایی رسید بانک نیست.',
  reversed: 'مبلغی که به‌خاطر مرجوعی، بازپرداخت یا اصلاح، از پاداش کم شده است.',
  disputed: 'مبلغی که تا تعیین تکلیف اختلاف کنار گذاشته شده است.',
};

export type LedgerRow = {
  idempotencyKey: string;
  bucket: RewardBucket;
  amount: number;
  entryType: string;
  orderId: string;
  ruleVersion: string | null;
};

export type QualifyingOrder = {
  orderType: string;
  subtotal: number;
  discount: number;
  walletApplied: number;
  shippingFee: number;
  taxAmount: number;
  cancelled: boolean;
  paymentStatus: 'NONE' | 'PENDING' | 'PAID' | 'REFUNDED';
  paidAmount: number;
  refundedAmount: number;
  returnedMerchandise: number;
};

export type QualifyingResult = {
  qualified: boolean;
  netMerchandise: number;
  reason: 'NOT_WHOLESALE' | 'CANCELLED' | 'ORDER_NOT_PAID' | 'NET_ZERO' | 'QUALIFIED';
  shippingExcluded: true;
  taxExcluded: true;
};

export function qualifyingNetMerchandise(order: QualifyingOrder): QualifyingResult {
  const excluded = { shippingExcluded: true as const, taxExcluded: true as const };
  if (order.orderType !== 'WHOLESALE') {
    return { qualified: false, netMerchandise: 0, reason: 'NOT_WHOLESALE', ...excluded };
  }
  if (order.cancelled || order.paymentStatus === 'REFUNDED') {
    return { qualified: false, netMerchandise: 0, reason: order.cancelled ? 'CANCELLED' : 'ORDER_NOT_PAID', ...excluded };
  }
  const promo = Math.max(0, order.discount - Math.max(0, order.walletApplied));
  const merchandise = Math.max(0, order.subtotal - promo - Math.max(0, order.returnedMerchandise));
  if (order.paymentStatus !== 'PAID' || order.paidAmount <= 0) {
    return { qualified: false, netMerchandise: merchandise, reason: 'ORDER_NOT_PAID', ...excluded };
  }
  const recognized = Math.min(merchandise, Math.max(0, order.paidAmount));
  const net = Math.max(0, recognized - Math.max(0, order.refundedAmount));
  if (net <= 0) return { qualified: false, netMerchandise: 0, reason: 'NET_ZERO', ...excluded };
  return { qualified: true, netMerchandise: net, reason: 'QUALIFIED', ...excluded };
}

export type RewardRule = {
  version: string;
  kind: 'RATE_BPS' | 'FIXED';
  rateBps: number | null;
  fixedAmount: number | null;
  cap: number | null;
};

export function rewardAmount(net: number, rule: RewardRule | null): number | null {
  if (!rule || net <= 0) return null;
  let amount = 0;
  if (rule.kind === 'RATE_BPS') {
    if (rule.rateBps == null || rule.rateBps < 0) return null;
    amount = Math.floor((net * rule.rateBps) / 10_000);
  } else if (rule.fixedAmount == null || rule.fixedAmount < 0) {
    return null;
  } else {
    amount = rule.fixedAmount;
  }
  if (rule.cap != null) amount = Math.min(amount, Math.max(0, rule.cap));
  return Math.max(0, Math.floor(amount));
}

export function ruleFromSettings(settings: WholesaleReferralSettings): RewardRule | null {
  if (!settings.rewardKind) return null;
  if (!settings.termsVersion || settings.termsVersion === DRAFT_TERMS_VERSION) return null;
  return {
    version: settings.termsVersion,
    kind: settings.rewardKind,
    rateBps: settings.rewardRateBps,
    fixedAmount: settings.rewardFixedAmount,
    cap: settings.rewardCap,
  };
}

function keysExist(existing: Set<string>, rows: LedgerRow[]): boolean {
  return rows.some((row) => existing.has(row.idempotencyKey));
}

export function planEstimate(input: {
  existingKeys: Set<string>;
  introductionId: string;
  orderId: string;
  order: QualifyingOrder;
  rule: RewardRule | null;
}): { rows: LedgerRow[]; blocked: string | null; net: number } {
  const netResult = qualifyingNetMerchandise(input.order);
  if (!netResult.qualified) {
    return { rows: [], blocked: netResult.reason, net: netResult.netMerchandise };
  }
  const amount = rewardAmount(netResult.netMerchandise, input.rule);
  if (amount == null) return { rows: [], blocked: 'RULE_UNSET', net: netResult.netMerchandise };
  if (amount <= 0) return { rows: [], blocked: 'AMOUNT_ZERO', net: netResult.netMerchandise };
  const row: LedgerRow = {
    idempotencyKey: `wr:estimate:${input.introductionId}:${input.orderId}:${input.rule?.version}`,
    bucket: 'estimated',
    amount,
    entryType: 'REWARD_ESTIMATED',
    orderId: input.orderId,
    ruleVersion: input.rule?.version ?? null,
  };
  if (keysExist(input.existingKeys, [row])) return { rows: [], blocked: null, net: netResult.netMerchandise };
  return { rows: [row], blocked: null, net: netResult.netMerchandise };
}

function bucketSum(rows: LedgerRow[], bucket: RewardBucket): number {
  return rows.reduce((sum, row) => (row.bucket === bucket ? sum + row.amount : sum), 0);
}

function transfer(input: {
  existingKeys: Set<string>;
  from: RewardBucket;
  to: RewardBucket;
  amount: number;
  key: string;
  orderId: string;
  ruleVersion: string | null;
  outType: string;
  inType: string;
}): LedgerRow[] {
  if (input.amount <= 0) return [];
  const rows: LedgerRow[] = [
    {
      idempotencyKey: `${input.key}:out`,
      bucket: input.from,
      amount: -input.amount,
      entryType: input.outType,
      orderId: input.orderId,
      ruleVersion: input.ruleVersion,
    },
    {
      idempotencyKey: `${input.key}:in`,
      bucket: input.to,
      amount: input.amount,
      entryType: input.inType,
      orderId: input.orderId,
      ruleVersion: input.ruleVersion,
    },
  ];
  if (keysExist(input.existingKeys, rows)) return [];
  return rows;
}

export function planHoldRelease(input: {
  existing: LedgerRow[];
  existingKeys: Set<string>;
  introductionId: string;
  orderId: string;
  to: 'held' | 'available' | 'paid';
  ruleVersion: string | null;
}): LedgerRow[] {
  const from: RewardBucket = input.to === 'held' ? 'estimated' : input.to === 'available' ? 'held' : 'available';
  const amount = bucketSum(input.existing, from);
  return transfer({
    existingKeys: input.existingKeys,
    from,
    to: input.to,
    amount,
    key: `wr:${input.to}:${input.introductionId}:${input.orderId}:${input.ruleVersion || 'none'}`,
    orderId: input.orderId,
    ruleVersion: input.ruleVersion,
    outType: 'REWARD_TRANSFER_OUT',
    inType: input.to === 'paid' ? 'PAYOUT_RECORDED' : 'REWARD_TRANSFER_IN',
  });
}

export function planRefundReversal(input: {
  existing: LedgerRow[];
  existingKeys: Set<string>;
  introductionId: string;
  orderId: string;
  previousNet: number;
  nextNet: number;
  eventId: string;
  ruleVersion: string | null;
}): LedgerRow[] {
  const key = `wr:reversal:${input.introductionId}:${input.orderId}:${input.eventId}`;
  if (input.existingKeys.has(`${key}:out`) || input.existingKeys.has(`${key}:in`)) return [];
  if (input.previousNet <= 0 || input.nextNet >= input.previousNet) return [];
  const openBuckets: RewardBucket[] = ['estimated', 'held', 'available'];
  const open = openBuckets.reduce((sum, bucket) => sum + Math.max(0, bucketSum(input.existing, bucket)), 0);
  if (open <= 0) return [];
  const reduction = input.nextNet <= 0 ? open : Math.min(open, Math.floor((open * (input.previousNet - input.nextNet)) / input.previousNet));
  if (reduction <= 0) return [];
  let left = reduction;
  const rows: LedgerRow[] = [];
  for (const bucket of openBuckets) {
    const available = Math.max(0, bucketSum(input.existing, bucket));
    if (available <= 0 || left <= 0) continue;
    const slice = Math.min(available, left);
    rows.push(
      ...transfer({
        existingKeys: input.existingKeys,
        from: bucket,
        to: 'reversed',
        amount: slice,
        key: `${key}:${bucket}`,
        orderId: input.orderId,
        ruleVersion: input.ruleVersion,
        outType: 'REWARD_REVERSAL',
        inType: 'REWARD_REVERSAL_IN',
      }),
    );
    left -= slice;
  }
  return rows;
}

export function bucketTotals(rows: LedgerRow[]): Record<RewardBucket, number> {
  return {
    estimated: bucketSum(rows, 'estimated'),
    held: bucketSum(rows, 'held'),
    available: bucketSum(rows, 'available'),
    paid: bucketSum(rows, 'paid'),
    reversed: bucketSum(rows, 'reversed'),
    disputed: bucketSum(rows, 'disputed'),
  };
}

export type PartnerIntroductionView = {
  id: string;
  stage: PartnerStage;
  stageLabel: string;
  explanation: string;
  nextAction: string;
  updatedAt: string;
  freshness: 'manual';
  freshnessNote: string;
  reasonCode: string | null;
  rewards: Record<RewardBucket, number>;
};

export function toPartnerIntroduction(input: {
  viewerPartnerId: string;
  row: {
    id: string;
    partnerId: string;
    stage: PartnerStage;
    partnerExplanation: string | null;
    reasonCode: string | null;
    nextAction: string | null;
    updatedAt: string;
    phone?: string | null;
    internalNote?: string | null;
    orderTotal?: number | null;
    lineItems?: unknown;
  };
  rewards: Record<RewardBucket, number>;
}): { ok: false; error: 'DENIED' } | { ok: true; view: PartnerIntroductionView } {
  if (input.viewerPartnerId !== input.row.partnerId) return { ok: false, error: 'DENIED' };
  const reason = input.row.reasonCode;
  const explanation =
    input.row.partnerExplanation?.trim() ||
    (reason ? PARTNER_REASON_FA[reason] : '') ||
    PARTNER_STAGE_LABEL[input.row.stage];
  return {
    ok: true,
    view: {
      id: input.row.id,
      stage: input.row.stage,
      stageLabel: PARTNER_STAGE_LABEL[input.row.stage],
      explanation,
      nextAction: input.row.nextAction?.trim() || 'منتظر به‌روزرسانی تیم فروش بمانید.',
      updatedAt: input.row.updatedAt,
      freshness: 'manual',
      freshnessNote: MANUAL_FRESHNESS_NOTE,
      reasonCode: reason,
      rewards: input.rewards,
    },
  };
}

export function canOpenDispute(actorPartnerId: string | null, introductionPartnerId: string): boolean {
  return !!actorPartnerId && actorPartnerId === introductionPartnerId;
}

export function canReviewReferral(role: string | null | undefined): boolean {
  return !!role && (REFERRAL_CRM_ROLES as readonly string[]).includes(role);
}

export function canAdjustReward(role: string | null | undefined): boolean {
  return !!role && (REFERRAL_FINANCE_ROLES as readonly string[]).includes(role);
}

export function canOverrideOwnership(role: string | null | undefined): boolean {
  return !!role && (REFERRAL_OWNERSHIP_OVERRIDE_ROLES as readonly string[]).includes(role);
}

export function validatePayoutIban(raw: string): { ok: true; iban: string } | { ok: false; error: string } {
  const iban = String(raw || '').replace(/\s/g, '').toUpperCase();
  if (!/^IR[0-9]{24}$/.test(iban)) {
    return { ok: false, error: 'شماره شبا باید با IR و ۲۴ رقم باشد.' };
  }
  return { ok: true, iban };
}

export function applyOwnershipOverride(input: {
  records: IntroRecord[];
  phone: string;
  nextPartnerId: string;
  now: string;
  windowDays: number | null;
  reason: string;
}): { ok: false; error: string } | { ok: true; records: IntroRecord[] } {
  const phone = normalizeIranMobile(input.phone);
  if (!phone) return { ok: false, error: 'شماره بوتیک معتبر نیست.' };
  if (!input.reason || input.reason.trim().length < 8) {
    return { ok: false, error: 'تغییر مالکیت دلیل مکتوب می‌خواهد.' };
  }
  if (input.windowDays == null || input.windowDays <= 0) {
    return { ok: false, error: 'تا تأیید پنجرهٔ مالکیت، تغییر مالکیت قفل نمی‌شود.' };
  }
  const target = input.records.find((row) => row.normalizedPhone === phone && row.partnerId === input.nextPartnerId);
  if (!target) return { ok: false, error: 'معرفی این همکار برای این شماره پیدا نشد.' };
  const expiresAt = addDays(input.now, input.windowDays);
  const records = input.records.map((row) => {
    if (row.normalizedPhone !== phone) return { ...row };
    if (row.id === target.id) {
      return { ...row, ownershipStatus: 'OWNED' as const, expiresAt, reasonCode: null, stage: row.stage };
    }
    if (row.ownershipStatus === 'OWNED') {
      return { ...row, ownershipStatus: 'CONFLICT' as const, reasonCode: 'OWNERSHIP_CONFLICT', stage: 'UNDER_REVIEW' as const };
    }
    return { ...row };
  });
  return { ok: true, records };
}

export function assertPayoutAllowed(available: number, minPayout: number | null): { ok: true } | { ok: false; error: string } {
  if (minPayout == null) return { ok: false, error: 'حداقل پرداخت هنوز تأیید نشده است.' };
  if (available < minPayout) return { ok: false, error: 'مبلغ قابل پرداخت به حداقل تعیین‌شده نرسیده است.' };
  return { ok: true };
}

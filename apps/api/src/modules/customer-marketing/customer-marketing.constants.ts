export const MARKETING_CHANNELS = ['RETAIL', 'WHOLESALE'] as const;
export type MarketingChannel = (typeof MARKETING_CHANNELS)[number];

export const CONSENT_STATUSES = ['REGISTER_AUTO', 'GRANTED', 'REVOKED'] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const CONSENT_SOURCES = ['OTP_RETAIL', 'WHOLESALE_APPLICATION', 'ADMIN_TOGGLE'] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export const MESSAGE_CLASSES = ['TRANSACTIONAL', 'NURTURE', 'PROMO'] as const;
export type MessageClass = (typeof MESSAGE_CLASSES)[number];

export const MARKETING_MODES = ['OFF', 'PREVIEW', 'CANARY', 'LIVE'] as const;
export type MarketingMode = (typeof MARKETING_MODES)[number];

export const SEND_STATUSES = ['QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED', 'SUPPRESSED'] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

export const CALL_RESULTS = ['CONNECTED', 'NO_ANSWER', 'BUSY', 'WRONG_NUMBER', 'CALLBACK'] as const;
export type CallResult = (typeof CALL_RESULTS)[number];

export const ACTIVITY_TYPES = ['SMS', 'CALL', 'CONSENT', 'ENROLL'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const FUNNEL_CODES = {
  RETAIL: 'retail_welcome',
  WHOLESALE: 'wholesale_application',
} as const;

export const DEFAULT_MARKETING_SETTINGS = {
  enabled: false,
  mode: 'OFF' as MarketingMode,
  quietStartHour: 21,
  quietEndHour: 9,
  nurturePerPhonePerDay: 1,
  promoPerPhonePerDay: 1,
  promoMinGapHours: 24,
  dailyCapPerChannel: 20,
  treatRegisterAutoAsPromoConsent: false,
  canaryPhoneRetail: '',
  canaryPhoneWholesale: '',
  scenarioModes: {} as Record<string, MarketingMode>,
};

export type MarketingSettings = typeof DEFAULT_MARKETING_SETTINGS;

export const SMS_IR_BULK_MAX = 100;

export const SETTINGS_KEY = 'customerMarketing';

export const RETAIL_STAGES = ['REGISTERED', 'ACTIVE_BUYER', 'REPEAT', 'DORMANT'] as const;
export const WHOLESALE_STAGES = ['APPLIED', 'NEEDS_DOCS', 'APPROVED', 'FIRST_ORDER', 'ACTIVE', 'DORMANT'] as const;

export const ALWAYS_OFF_SCENARIOS = [
  'retail.browse.no_buy_24h',
  'wholesale.restock.ping',
] as const;

export const OVERLAP_SCENARIOS = [
  'retail.checkout.abandoned',
  'wholesale.apply.approved_intro',
] as const;

export const SETTLED_ORDER_STATUSES = [
  'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED',
] as const;

export const MODE_RANK: Record<MarketingMode, number> = {
  OFF: 0,
  PREVIEW: 1,
  CANARY: 2,
  LIVE: 3,
};

export function effectiveMode(globalMode: MarketingMode, scenarioMode?: MarketingMode | null): MarketingMode {
  const scenario = scenarioMode && MODE_RANK[scenarioMode] != null ? scenarioMode : 'OFF';
  return MODE_RANK[scenario] <= MODE_RANK[globalMode] ? scenario : globalMode;
}

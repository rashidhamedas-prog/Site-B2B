/**
 * PR-10 — per-destination channel settings (REQ-C10).
 * Stored as publishSettings.channelSettings (D-1); flat keys still read for compat.
 * Content never falls back to connection/global. Empty defaults — never invent LIVE ids.
 */
import { assertNoPlaintextSecrets } from './omnichannel-secrets';

/** Normalized claim forms (ZWNJ / half-space / spaced). */
export const FORBIDDEN_PRODUCT_CLAIMS = ['ضدآب', 'ضد آب', 'ضد‌آب'] as const;

export const CHANNEL_CONTENT_KEYS = [
  'captionIntro',
  'footerText',
  'hashtags',
  'ctaText',
  'contactId',
  'orderBotId',
  'orderBotUsername',
  'channelLink',
  'utmSource',
  'utmCampaign',
  'botUsername',
  'showPriceDefault',
  'ownerChatId',
] as const;

export type ChannelContentKey = (typeof CHANNEL_CONTENT_KEYS)[number];

export type ChannelContentSettings = {
  captionIntro: string;
  footerText: string;
  hashtags: string;
  ctaText: string;
  contactId: string;
  orderBotId: string;
  orderBotUsername: string;
  channelLink: string;
  utmSource: string;
  utmCampaign: string;
  /** Publish-bot display name (not token). */
  botUsername: string;
  /** Policy default; false until Owner enables. Alias: showPrice. */
  showPriceDefault: boolean;
  /** «آی‌دی مقصد هدایت پیام‌ها» — empty for Hamed; never invent. */
  ownerChatId: string;
};

export type ChannelContentPatch = Partial<{
  captionIntro: string | null;
  footerText: string | null;
  hashtags: string | null | string[];
  ctaText: string | null;
  contactId: string | null;
  orderBotId: string | null;
  orderBotUsername: string | null;
  channelLink: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  botUsername: string | null;
  showPriceDefault: boolean;
  /** Compat alias → showPriceDefault */
  showPrice: boolean;
  ownerChatId: string | null;
}>;

/** Content keys Publisher may draft without Owner policy. */
export const CHANNEL_PUBLISHER_CONTENT_KEYS = [
  'captionIntro',
  'footerText',
  'hashtags',
  'ctaText',
  'contactId',
  'orderBotId',
  'orderBotUsername',
  'channelLink',
  'utmSource',
  'utmCampaign',
  'botUsername',
] as const;

/** Owner + goRef when RBAC on. */
export const CHANNEL_OWNER_POLICY_KEYS = [
  'showPriceDefault',
  'showPrice',
  'ownerChatId',
  'emergencyHold',
  'autoPublishMode',
  'autoDailyCap',
  'autoMinGapSeconds',
  'quietStartHour',
  'quietEndHour',
] as const;

export function emptyChannelContentSettings(): ChannelContentSettings {
  return {
    captionIntro: '',
    footerText: '',
    hashtags: '',
    ctaText: '',
    contactId: '',
    orderBotId: '',
    orderBotUsername: '',
    channelLink: '',
    utmSource: '',
    utmCampaign: '',
    botUsername: '',
    showPriceDefault: false,
    ownerChatId: '',
  };
}

function trimField(value: unknown, max: number): string {
  if (value == null) return '';
  return String(value).replace(/[\u0000-\u001F]/g, '').trim().slice(0, max);
}

function normalizeHashtags(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => trimField(item, 64))
      .filter(Boolean)
      .join(' ')
      .slice(0, 500);
  }
  return trimField(value, 500);
}

function parseOptionalBool(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/** Strip ZWNJ/half-space so «ضد‌آب» matches. */
export function normalizeClaimText(text: string): string {
  return String(text || '')
    .replace(/[\u200c\u200d\u00ad]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Content-only parse — never invents LIVE ids; missing keys → empty/false. */
export function parseChannelContentSettings(value: unknown): ChannelContentSettings {
  const base = emptyChannelContentSettings();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const root = value as Record<string, unknown>;
  const nested =
    root.channelSettings && typeof root.channelSettings === 'object' && !Array.isArray(root.channelSettings)
      ? (root.channelSettings as Record<string, unknown>)
      : null;
  const raw = { ...root, ...(nested || {}) };
  base.captionIntro = trimField(raw.captionIntro, 500);
  base.footerText = trimField(raw.footerText, 1000);
  base.hashtags = normalizeHashtags(raw.hashtags);
  base.ctaText = trimField(raw.ctaText, 240);
  base.contactId = trimField(raw.contactId, 64);
  base.orderBotId = trimField(raw.orderBotId, 64);
  base.orderBotUsername = trimField(raw.orderBotUsername, 64).replace(/^@+/, '');
  base.channelLink = trimField(raw.channelLink, 500);
  base.utmSource = trimField(raw.utmSource, 64);
  base.utmCampaign = trimField(raw.utmCampaign, 64);
  base.botUsername = trimField(raw.botUsername, 64).replace(/^@+/, '');
  base.ownerChatId = trimField(raw.ownerChatId, 64);
  const show =
    parseOptionalBool(raw.showPriceDefault)
    ?? parseOptionalBool(raw.showPrice);
  base.showPriceDefault = show === true;
  return base;
}

export function hasChannelContentPatch(patch: ChannelContentPatch): boolean {
  return CHANNEL_CONTENT_KEYS.some((key) => (patch as Record<string, unknown>)[key] !== undefined)
    || (patch as ChannelContentPatch).showPrice !== undefined;
}

export function patchTouchesOwnerPolicy(patch: Record<string, unknown>): boolean {
  return CHANNEL_OWNER_POLICY_KEYS.some((key) => patch[key] !== undefined);
}

export function mergeChannelContentSettingsPatch(
  previous: ChannelContentSettings,
  patch: ChannelContentPatch,
): ChannelContentSettings {
  const next = { ...previous };
  if (patch.captionIntro !== undefined) next.captionIntro = trimField(patch.captionIntro, 500);
  if (patch.footerText !== undefined) next.footerText = trimField(patch.footerText, 1000);
  if (patch.hashtags !== undefined) next.hashtags = normalizeHashtags(patch.hashtags);
  if (patch.ctaText !== undefined) next.ctaText = trimField(patch.ctaText, 240);
  if (patch.contactId !== undefined) next.contactId = trimField(patch.contactId, 64);
  if (patch.orderBotId !== undefined) next.orderBotId = trimField(patch.orderBotId, 64);
  if (patch.orderBotUsername !== undefined) {
    next.orderBotUsername = trimField(patch.orderBotUsername, 64).replace(/^@+/, '');
  }
  if (patch.channelLink !== undefined) next.channelLink = trimField(patch.channelLink, 500);
  if (patch.utmSource !== undefined) next.utmSource = trimField(patch.utmSource, 64);
  if (patch.utmCampaign !== undefined) next.utmCampaign = trimField(patch.utmCampaign, 64);
  if (patch.botUsername !== undefined) {
    next.botUsername = trimField(patch.botUsername, 64).replace(/^@+/, '');
  }
  if (patch.ownerChatId !== undefined) next.ownerChatId = trimField(patch.ownerChatId, 64);
  const show =
    parseOptionalBool(patch.showPriceDefault)
    ?? parseOptionalBool(patch.showPrice);
  if (show !== undefined) next.showPriceDefault = show;
  return parseChannelContentSettings(next);
}

/** Nested bag written into publishSettings (D-1). */
export function channelSettingsBlob(content: ChannelContentSettings): Record<string, unknown> {
  return {
    captionIntro: content.captionIntro || undefined,
    footerText: content.footerText || undefined,
    hashtags: content.hashtags || undefined,
    ctaText: content.ctaText || undefined,
    contactId: content.contactId || undefined,
    orderBotId: content.orderBotId || undefined,
    orderBotUsername: content.orderBotUsername || undefined,
    channelLink: content.channelLink || undefined,
    utmSource: content.utmSource || undefined,
    utmCampaign: content.utmCampaign || undefined,
    botUsername: content.botUsername || undefined,
    ownerChatId: content.ownerChatId || undefined,
    showPriceDefault: content.showPriceDefault === true,
  };
}

export function assertChannelContentInput(input: unknown): void {
  assertNoPlaintextSecrets(input);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('invalid_channel_settings');
  }
  const raw = input as Record<string, unknown>;
  const allowed = new Set<string>([
    ...CHANNEL_CONTENT_KEYS,
    'showPrice',
    'reason',
    'goRef',
    'includeAutomation',
    'sourceDestinationId',
    'channelSettings',
  ]);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key) && !isAutomationCompatKey(key)) {
      throw new Error(`unknown_channel_field:${key}`);
    }
  }
  if (raw.showPriceDefault !== undefined && parseOptionalBool(raw.showPriceDefault) === undefined) {
    throw new Error('invalid_show_price');
  }
  if (raw.showPrice !== undefined && parseOptionalBool(raw.showPrice) === undefined) {
    throw new Error('invalid_show_price');
  }
  if (raw.channelLink !== undefined && raw.channelLink !== null && String(raw.channelLink).trim()) {
    assertChannelLink(String(raw.channelLink));
  }
  for (const userKey of ['botUsername', 'orderBotUsername'] as const) {
    if (raw[userKey] !== undefined && raw[userKey] !== null) {
      const u = trimField(raw[userKey], 64).replace(/^@+/, '');
      if (u && !/^[A-Za-z0-9_]{3,64}$/.test(u)) throw new Error(`invalid_${userKey}`);
    }
  }
  const textBits = [
    raw.captionIntro,
    raw.footerText,
    raw.ctaText,
    raw.hashtags,
  ]
    .map((v) => (Array.isArray(v) ? v.join(' ') : String(v || '')))
    .join('\n');
  assertNoForbiddenProductClaims(textBits);
}

function isAutomationCompatKey(key: string): boolean {
  return [
    'oosPolicy',
    'autoPublishEventTypes',
    'autoPublishMode',
    'autoDailyCap',
    'autoMinGapSeconds',
    'quietStartHour',
    'quietEndHour',
    'withdrawAction',
    'autoPublishCategoryIds',
    'emergencyHold',
    'includeTemplate',
  ].includes(key);
}

export function assertChannelLink(raw: string): void {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('invalid_channel_link');
  }
  if (url.protocol !== 'https:') throw new Error('invalid_channel_link');
  if (url.username || url.password) throw new Error('invalid_channel_link');
}

/** Persian claim guard (REQ-C7). ZWNJ/half-space normalized. */
export function findForbiddenProductClaim(text: string): string | null {
  const normalized = normalizeClaimText(text);
  if (normalized.includes('ضدآب') || /ضد\s*آب/.test(normalized)) return 'ضدآب';
  return null;
}

export function assertNoForbiddenProductClaims(text: string): void {
  const hit = findForbiddenProductClaim(text);
  if (hit) {
    const err = new Error(`ادعای «${hit}» در قالب/کپشن مجاز نیست`);
    (err as Error & { code?: string }).code = 'forbidden_product_claim';
    throw err;
  }
}

/** Append utm_source / utm_campaign when set; never invent defaults. */
export function appendUtmToUrl(
  rawUrl: string,
  utm: { utmSource?: string; utmCampaign?: string },
): string {
  const base = String(rawUrl || '').trim();
  if (!base) return '';
  const source = trimField(utm.utmSource, 64);
  const campaign = trimField(utm.utmCampaign, 64);
  if (!source && !campaign) return base;
  try {
    const url = new URL(base);
    if (source) url.searchParams.set('utm_source', source);
    if (campaign) url.searchParams.set('utm_campaign', campaign);
    return url.toString();
  } catch {
    return base;
  }
}

export function formatMinOrderQty(minOrderQty: unknown): string {
  const n = Number(minOrderQty);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.floor(n));
}

export function applyShowPriceToVars(
  vars: { price: string; packPrice: string },
  showPrice: boolean,
): { price: string; packPrice: string } {
  if (showPrice) return vars;
  return { price: '', packPrice: '' };
}

/** Copy content values only — never shares destination row identity. */
export function copyChannelContent(
  source: ChannelContentSettings,
): ChannelContentSettings {
  return parseChannelContentSettings({ ...source });
}

export function publicChannelContentSettings(content: ChannelContentSettings) {
  return {
    ...content,
    /** Compat alias for older clients / PR-9. */
    showPrice: content.showPriceDefault === true,
    contentSource: 'destination' as const,
  };
}

/** Policy-tier stop distinct from autoPublishMode (PR-10 D-4). */
export function readEmergencyHold(stored: unknown): boolean {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return false;
  return (stored as Record<string, unknown>).emergencyHold === true;
}

export function withEmergencyHold(
  stored: Record<string, unknown> | null | undefined,
  hold: boolean,
): Record<string, unknown> {
  const next = { ...(stored || {}) };
  next.emergencyHold = hold === true;
  next.seeded = true;
  return next;
}

/** Merge content into publishSettings as nested channelSettings; strip flat content keys. */
export function writeChannelSettingsIntoPublish(
  previous: Record<string, unknown> | null | undefined,
  content: ChannelContentSettings,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(previous || {}), seeded: true };
  for (const key of CHANNEL_CONTENT_KEYS) {
    delete next[key];
  }
  delete next.showPrice;
  next.channelSettings = channelSettingsBlob(content);
  return next;
}

/**
 * PR-13 read helper — Owner-entered ownerChatId only; never invent LIVE ids.
 * Accepts destination.publishSettings (flat or nested channelSettings).
 */
export function ownerChatIdForDestination(publishSettings: unknown): string {
  return parseChannelContentSettings(publishSettings).ownerChatId;
}

export function ownerChatIdConfigured(publishSettings: unknown): boolean {
  return ownerChatIdForDestination(publishSettings).length > 0;
}

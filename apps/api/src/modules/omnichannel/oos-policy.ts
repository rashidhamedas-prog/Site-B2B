import { BadRequestException } from '@nestjs/common';
import {
  AUTO_DAILY_CAP_MAX,
  AUTO_DAILY_CAP_MIN,
  AUTO_MIN_GAP_MAX_SECONDS,
  AUTO_MIN_GAP_MIN_SECONDS,
  AUTO_PUBLISH_CANDIDATE_EVENTS,
  AUTO_PUBLISH_MODES,
  DEFAULT_AUTO_DAILY_CAP,
  DEFAULT_AUTO_MIN_GAP_SECONDS,
  DEFAULT_AUTO_PUBLISH_MODE,
  DEFAULT_OUTBOX_RETENTION_DAYS,
  DEFAULT_RETRY_SLA_SECONDS,
  DEFAULT_WITHDRAW_ACTION,
  OMNICHANNEL_PROVIDERS,
  OOS_POLICIES,
  OUTBOX_RETENTION_MAX_DAYS,
  OUTBOX_RETENTION_MIN_DAYS,
  RETRY_SLA_MAX_SECONDS,
  RETRY_SLA_MIN_SECONDS,
  WITHDRAW_ACTIONS,
  isOmnichannelProvider,
  type AutoPublishEventType,
  type AutoPublishMode,
  type OmnichannelProvider,
  type OosPolicy,
  type WithdrawAction,
} from './omnichannel.constants';
import { assertNoPlaintextSecrets, isAllowedSecretRef } from './omnichannel-secrets';

export { OOS_POLICIES, type OosPolicy };

export const OMNICHANNEL_SETTINGS_KEY = 'omnichannel';
export const DEFAULT_OOS_POLICY: OosPolicy = 'UPDATE';

export type StoredOmnichannelSettings = {
  retailOosPolicy?: OosPolicy;
  wholesaleOosPolicy?: OosPolicy;
  retailOosChosen?: boolean;
  wholesaleOosChosen?: boolean;
  autoPublishEventTypes?: AutoPublishEventType[];
  autoPublishEventTypesChosen?: boolean;
  retrySlaSeconds?: number;
  retrySlaChosen?: boolean;
  outboxRetentionDays?: number;
  outboxRetentionChosen?: boolean;
  /** Channel automation (owner-flipped). Absent = OFF. */
  autoPublishMode?: AutoPublishMode;
  autoDailyCap?: number;
  autoMinGapSeconds?: number;
  /** Tehran hours 0..23; both present = quiet window, posts defer to the end hour. */
  quietStartHour?: number;
  quietEndHour?: number;
  withdrawAction?: WithdrawAction;
};

/** Read-only snapshot written by the server after getChat/getChatMember. Never admin input. */
export type DestinationVerification = {
  checkedAt: string;
  ok: boolean;
  error?: string;
  chatType?: string;
  title?: string;
  username?: string | null;
  memberCount?: number | null;
  botIsAdmin?: boolean;
  canPost?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  /** How posting rights were established: getChatMember-style API or a successful test post. */
  permissionCheck?: 'api' | 'test_post' | 'unavailable';
  /** ISO time of the last successful admin test post to this destination. */
  testPostAt?: string;
};

export type OosDecision = {
  policy: OosPolicy;
  source: 'admin' | 'default';
  local: 'refresh' | 'skip_create' | 'withdraw_local';
  remote: 'CREATE' | 'UPDATE' | 'DELETE' | 'none';
};

export type PreviewOosAnnotation = {
  oosPolicy: OosPolicy;
  oosPolicySource: 'admin' | 'default';
  oosRemoteAction: OosDecision['remote'];
  available: boolean;
  stock: number | null;
};

const SETTINGS_INPUT_KEYS = new Set([
  'retailOosPolicy',
  'wholesaleOosPolicy',
  'autoPublishEventTypes',
  'retrySlaSeconds',
  'outboxRetentionDays',
  'autoPublishMode',
  'autoDailyCap',
  'autoMinGapSeconds',
  'quietStartHour',
  'quietEndHour',
  'withdrawAction',
  'reason',
]);

const AUTO_PUBLISH_EVENT_SET = new Set<string>(AUTO_PUBLISH_CANDIDATE_EVENTS);

export function isAutoPublishMode(value: unknown): value is AutoPublishMode {
  return typeof value === 'string' && (AUTO_PUBLISH_MODES as readonly string[]).includes(value);
}

export function isWithdrawAction(value: unknown): value is WithdrawAction {
  return typeof value === 'string' && (WITHDRAW_ACTIONS as readonly string[]).includes(value);
}

/** `null` clears a quiet hour; undefined leaves it; 0..23 sets it. */
function parseHourOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return parseBoundedInt(value, 0, 23) ?? undefined;
}

export type AutomationSettings = {
  mode: AutoPublishMode;
  dailyCap: number;
  minGapSeconds: number;
  quietStartHour: number | null;
  quietEndHour: number | null;
  withdrawAction: WithdrawAction;
};

export function readAutomationSettings(stored: StoredOmnichannelSettings): AutomationSettings {
  const quietStart = typeof stored.quietStartHour === 'number' ? stored.quietStartHour : null;
  const quietEnd = typeof stored.quietEndHour === 'number' ? stored.quietEndHour : null;
  const both = quietStart != null && quietEnd != null && quietStart !== quietEnd;
  return {
    mode: isAutoPublishMode(stored.autoPublishMode) ? stored.autoPublishMode : DEFAULT_AUTO_PUBLISH_MODE,
    dailyCap: typeof stored.autoDailyCap === 'number' ? stored.autoDailyCap : DEFAULT_AUTO_DAILY_CAP,
    minGapSeconds: typeof stored.autoMinGapSeconds === 'number' ? stored.autoMinGapSeconds : DEFAULT_AUTO_MIN_GAP_SECONDS,
    quietStartHour: both ? quietStart : null,
    quietEndHour: both ? quietEnd : null,
    withdrawAction: isWithdrawAction(stored.withdrawAction) ? stored.withdrawAction : DEFAULT_WITHDRAW_ACTION,
  };
}

export function isOosPolicy(value: unknown): value is OosPolicy {
  return value === 'UPDATE' || value === 'HIDE' || value === 'DELETE';
}

export function parseOosPolicy(value: unknown): OosPolicy | null {
  return isOosPolicy(value) ? value : null;
}

export function parseAutoPublishEventTypes(value: unknown): AutoPublishEventType[] | null {
  if (!Array.isArray(value)) return null;
  const unique: AutoPublishEventType[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !AUTO_PUBLISH_EVENT_SET.has(item)) return null;
    if (!unique.includes(item as AutoPublishEventType)) unique.push(item as AutoPublishEventType);
  }
  return unique;
}

export function parseBoundedInt(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

export function readAutoPublishEventTypes(
  stored: StoredOmnichannelSettings,
): { events: AutoPublishEventType[]; chosen: boolean } {
  if (stored.autoPublishEventTypesChosen === true && stored.autoPublishEventTypes) {
    return { events: stored.autoPublishEventTypes, chosen: true };
  }
  return { events: [...AUTO_PUBLISH_CANDIDATE_EVENTS], chosen: false };
}

export function readRetrySlaSeconds(stored: StoredOmnichannelSettings): { seconds: number; chosen: boolean } {
  if (stored.retrySlaChosen === true && stored.retrySlaSeconds != null) {
    return { seconds: stored.retrySlaSeconds, chosen: true };
  }
  return { seconds: DEFAULT_RETRY_SLA_SECONDS, chosen: false };
}

export function readOutboxRetentionDays(stored: StoredOmnichannelSettings): { days: number; chosen: boolean } {
  if (stored.outboxRetentionChosen === true && stored.outboxRetentionDays != null) {
    return { days: stored.outboxRetentionDays, chosen: true };
  }
  return { days: DEFAULT_OUTBOX_RETENTION_DAYS, chosen: false };
}

/** Unchosen keeps the current hardcoded 3600s cap. Not wired into the worker in this slice. */
export function effectiveWorkerRetrySlaSeconds(stored: StoredOmnichannelSettings): number {
  const read = readRetrySlaSeconds(stored);
  return read.chosen ? read.seconds : DEFAULT_RETRY_SLA_SECONDS;
}

/** Unchosen means no retention job. Never delete PENDING/PROCESSING. */
export function effectiveWorkerRetentionDays(stored: StoredOmnichannelSettings): number | null {
  const read = readOutboxRetentionDays(stored);
  return read.chosen ? read.days : null;
}

export function readChannelOos(
  stored: StoredOmnichannelSettings,
  channel: 'RETAIL' | 'WHOLESALE',
): { policy: OosPolicy; chosen: boolean } {
  const chosenFlag = channel === 'RETAIL' ? stored.retailOosChosen === true : stored.wholesaleOosChosen === true;
  const parsed = parseOosPolicy(channel === 'RETAIL' ? stored.retailOosPolicy : stored.wholesaleOosPolicy);
  if (chosenFlag && parsed) return { policy: parsed, chosen: true };
  return { policy: DEFAULT_OOS_POLICY, chosen: false };
}

export function resolveOosDecision(input: {
  channel: 'RETAIL' | 'WHOLESALE';
  available: boolean;
  hasRemoteMessage: boolean;
  policy?: string | null;
  chosen?: boolean;
}): OosDecision {
  const parsed = parseOosPolicy(input.policy);
  const chosen = input.chosen === true && parsed != null;
  const policy = chosen ? parsed : DEFAULT_OOS_POLICY;
  const source: OosDecision['source'] = chosen ? 'admin' : 'default';

  if (!chosen) {
    return { policy, source, local: 'refresh', remote: 'none' };
  }

  if (input.available) {
    return {
      policy,
      source,
      local: 'refresh',
      remote: input.hasRemoteMessage ? 'UPDATE' : 'CREATE',
    };
  }

  if (policy === 'UPDATE') {
    return {
      policy,
      source,
      local: 'refresh',
      remote: input.hasRemoteMessage ? 'UPDATE' : 'CREATE',
    };
  }

  if (policy === 'HIDE') {
    return input.hasRemoteMessage
      ? { policy, source, local: 'withdraw_local', remote: 'UPDATE' }
      : { policy, source, local: 'skip_create', remote: 'none' };
  }

  return input.hasRemoteMessage
    ? { policy, source, local: 'withdraw_local', remote: 'DELETE' }
    : { policy, source, local: 'skip_create', remote: 'none' };
}

export function liveOosRejectReason(decision: OosDecision, available: boolean): string | null {
  if (available) return null;
  if (decision.source !== 'admin') return null;
  if ((decision.policy === 'HIDE' || decision.policy === 'DELETE') && decision.remote === 'none') {
    return `oos_${decision.policy.toLowerCase()}_skip`;
  }
  return null;
}

export function parseStoredOmnichannelSettings(value: unknown): StoredOmnichannelSettings {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const out: StoredOmnichannelSettings = {};
  const retail = parseOosPolicy(raw.retailOosPolicy);
  const wholesale = parseOosPolicy(raw.wholesaleOosPolicy);
  if (retail) out.retailOosPolicy = retail;
  if (wholesale) out.wholesaleOosPolicy = wholesale;
  if (raw.retailOosChosen === true && retail) out.retailOosChosen = true;
  if (raw.wholesaleOosChosen === true && wholesale) out.wholesaleOosChosen = true;
  const events = parseAutoPublishEventTypes(raw.autoPublishEventTypes);
  if (events && raw.autoPublishEventTypesChosen === true) {
    out.autoPublishEventTypes = events;
    out.autoPublishEventTypesChosen = true;
  }
  const retry = parseBoundedInt(raw.retrySlaSeconds, RETRY_SLA_MIN_SECONDS, RETRY_SLA_MAX_SECONDS);
  if (retry != null && raw.retrySlaChosen === true) {
    out.retrySlaSeconds = retry;
    out.retrySlaChosen = true;
  }
  const retention = parseBoundedInt(raw.outboxRetentionDays, OUTBOX_RETENTION_MIN_DAYS, OUTBOX_RETENTION_MAX_DAYS);
  if (retention != null && raw.outboxRetentionChosen === true) {
    out.outboxRetentionDays = retention;
    out.outboxRetentionChosen = true;
  }
  if (isAutoPublishMode(raw.autoPublishMode)) out.autoPublishMode = raw.autoPublishMode;
  const cap = parseBoundedInt(raw.autoDailyCap, AUTO_DAILY_CAP_MIN, AUTO_DAILY_CAP_MAX);
  if (cap != null) out.autoDailyCap = cap;
  const gap = parseBoundedInt(raw.autoMinGapSeconds, AUTO_MIN_GAP_MIN_SECONDS, AUTO_MIN_GAP_MAX_SECONDS);
  if (gap != null) out.autoMinGapSeconds = gap;
  const quietStart = parseBoundedInt(raw.quietStartHour, 0, 23);
  const quietEnd = parseBoundedInt(raw.quietEndHour, 0, 23);
  if (quietStart != null && quietEnd != null) {
    out.quietStartHour = quietStart;
    out.quietEndHour = quietEnd;
  }
  if (isWithdrawAction(raw.withdrawAction)) out.withdrawAction = raw.withdrawAction;
  return out;
}

export function assertOmnichannelSettingsInput(input: unknown): void {
  assertNoPlaintextSecrets(input);
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('بدنه تنظیمات نامعتبر است');
  }
  const raw = input as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!SETTINGS_INPUT_KEYS.has(key)) {
      throw new BadRequestException(`فیلد ${key} مجاز نیست`);
    }
  }
  if (raw.autoPublishMode !== undefined && !isAutoPublishMode(raw.autoPublishMode)) {
    throw new BadRequestException('حالت انتشار خودکار باید OFF یا CANARY یا LIVE باشد');
  }
  if (raw.autoDailyCap !== undefined && parseBoundedInt(raw.autoDailyCap, AUTO_DAILY_CAP_MIN, AUTO_DAILY_CAP_MAX) == null) {
    throw new BadRequestException(`سقف روزانه باید بین ${AUTO_DAILY_CAP_MIN} و ${AUTO_DAILY_CAP_MAX} پست باشد`);
  }
  if (raw.autoMinGapSeconds !== undefined && parseBoundedInt(raw.autoMinGapSeconds, AUTO_MIN_GAP_MIN_SECONDS, AUTO_MIN_GAP_MAX_SECONDS) == null) {
    throw new BadRequestException('فاصله بین پست‌ها باید بین ۰ و ۳۶۰۰ ثانیه باشد');
  }
  if (raw.quietStartHour !== undefined && parseHourOrNull(raw.quietStartHour) === undefined) {
    throw new BadRequestException('ساعت شروع سکوت باید بین ۰ و ۲۳ باشد');
  }
  if (raw.quietEndHour !== undefined && parseHourOrNull(raw.quietEndHour) === undefined) {
    throw new BadRequestException('ساعت پایان سکوت باید بین ۰ و ۲۳ باشد');
  }
  if (raw.withdrawAction !== undefined && !isWithdrawAction(raw.withdrawAction)) {
    throw new BadRequestException('رفتار حذف محصول باید DELETE یا KEEP باشد');
  }
  if (raw.retailOosPolicy !== undefined && !isOosPolicy(raw.retailOosPolicy)) {
    throw new BadRequestException('سیاست ناموجود تکی باید UPDATE یا HIDE یا DELETE باشد');
  }
  if (raw.wholesaleOosPolicy !== undefined && !isOosPolicy(raw.wholesaleOosPolicy)) {
    throw new BadRequestException('سیاست ناموجود عمده باید UPDATE یا HIDE یا DELETE باشد');
  }
  if (raw.autoPublishEventTypes !== undefined && !parseAutoPublishEventTypes(raw.autoPublishEventTypes)) {
    throw new BadRequestException('رویداد انتشار خودکار نامعتبر است');
  }
  if (raw.retrySlaSeconds !== undefined && parseBoundedInt(raw.retrySlaSeconds, RETRY_SLA_MIN_SECONDS, RETRY_SLA_MAX_SECONDS) == null) {
    throw new BadRequestException('مهلت تلاش مجدد باید بین ۶۰ و ۸۶۴۰۰ ثانیه باشد');
  }
  if (raw.outboxRetentionDays !== undefined && parseBoundedInt(raw.outboxRetentionDays, OUTBOX_RETENTION_MIN_DAYS, OUTBOX_RETENTION_MAX_DAYS) == null) {
    throw new BadRequestException('نگهداری صف باید بین ۷ و ۳۶۵ روز باشد');
  }
}

export type OmnichannelSettingsPatch = {
  retailOosPolicy?: OosPolicy;
  wholesaleOosPolicy?: OosPolicy;
  autoPublishEventTypes?: string[];
  retrySlaSeconds?: number;
  outboxRetentionDays?: number;
  autoPublishMode?: string;
  autoDailyCap?: number;
  autoMinGapSeconds?: number;
  quietStartHour?: number | null;
  quietEndHour?: number | null;
  withdrawAction?: string;
};

export function hasAutomationPatch(patch: OmnichannelSettingsPatch): boolean {
  return patch.autoPublishMode !== undefined
    || patch.autoDailyCap !== undefined
    || patch.autoMinGapSeconds !== undefined
    || patch.quietStartHour !== undefined
    || patch.quietEndHour !== undefined
    || patch.withdrawAction !== undefined;
}

export function mergeOmnichannelSettingsPatch(
  previous: StoredOmnichannelSettings,
  patch: OmnichannelSettingsPatch,
): StoredOmnichannelSettings {
  const next: StoredOmnichannelSettings = { ...previous };
  if (isAutoPublishMode(patch.autoPublishMode)) next.autoPublishMode = patch.autoPublishMode;
  const cap = parseBoundedInt(patch.autoDailyCap, AUTO_DAILY_CAP_MIN, AUTO_DAILY_CAP_MAX);
  if (cap != null) next.autoDailyCap = cap;
  const gap = parseBoundedInt(patch.autoMinGapSeconds, AUTO_MIN_GAP_MIN_SECONDS, AUTO_MIN_GAP_MAX_SECONDS);
  if (gap != null) next.autoMinGapSeconds = gap;
  const quietStart = parseHourOrNull(patch.quietStartHour);
  const quietEnd = parseHourOrNull(patch.quietEndHour);
  if (quietStart === null || quietEnd === null) {
    delete next.quietStartHour;
    delete next.quietEndHour;
  } else {
    if (quietStart !== undefined) next.quietStartHour = quietStart;
    if (quietEnd !== undefined) next.quietEndHour = quietEnd;
  }
  if (isWithdrawAction(patch.withdrawAction)) next.withdrawAction = patch.withdrawAction;
  if (patch.retailOosPolicy) {
    next.retailOosPolicy = patch.retailOosPolicy;
    next.retailOosChosen = true;
  }
  if (patch.wholesaleOosPolicy) {
    next.wholesaleOosPolicy = patch.wholesaleOosPolicy;
    next.wholesaleOosChosen = true;
  }
  const events = parseAutoPublishEventTypes(patch.autoPublishEventTypes);
  if (events) {
    next.autoPublishEventTypes = events;
    next.autoPublishEventTypesChosen = true;
  }
  const retry = parseBoundedInt(patch.retrySlaSeconds, RETRY_SLA_MIN_SECONDS, RETRY_SLA_MAX_SECONDS);
  if (retry != null) {
    next.retrySlaSeconds = retry;
    next.retrySlaChosen = true;
  }
  const retention = parseBoundedInt(patch.outboxRetentionDays, OUTBOX_RETENTION_MIN_DAYS, OUTBOX_RETENTION_MAX_DAYS);
  if (retention != null) {
    next.outboxRetentionDays = retention;
    next.outboxRetentionChosen = true;
  }
  return parseStoredOmnichannelSettings(next);
}

export type CanaryIdsByChannel = Record<'RETAIL' | 'WHOLESALE', Record<OmnichannelProvider, string | null>>;

export function emptyCanaryIdsByChannel(): CanaryIdsByChannel {
  const empty = () => Object.fromEntries(OMNICHANNEL_PROVIDERS.map((p) => [p, null])) as Record<OmnichannelProvider, string | null>;
  return { RETAIL: empty(), WHOLESALE: empty() };
}

export function publicOmnichannelSettings(
  stored: StoredOmnichannelSettings,
  canaries: { retail: string | null; wholesale: string | null; byProvider?: CanaryIdsByChannel },
) {
  const retail = readChannelOos(stored, 'RETAIL');
  const wholesale = readChannelOos(stored, 'WHOLESALE');
  const events = readAutoPublishEventTypes(stored);
  const retry = readRetrySlaSeconds(stored);
  const retention = readOutboxRetentionDays(stored);
  const automation = readAutomationSettings(stored);
  return {
    retailOosPolicy: retail.policy,
    wholesaleOosPolicy: wholesale.policy,
    retailOosChosen: retail.chosen,
    wholesaleOosChosen: wholesale.chosen,
    retailCanaryDestinationId: canaries.retail,
    wholesaleCanaryDestinationId: canaries.wholesale,
    canaryDestinationIds: canaries.byProvider || emptyCanaryIdsByChannel(),
    autoPublishEventTypes: events.events,
    autoPublishEventTypesChosen: events.chosen,
    retrySlaSeconds: retry.seconds,
    retrySlaChosen: retry.chosen,
    outboxRetentionDays: retention.days,
    outboxRetentionChosen: retention.chosen,
    autoPublishMode: automation.mode,
    autoDailyCap: automation.dailyCap,
    autoMinGapSeconds: automation.minGapSeconds,
    quietStartHour: automation.quietStartHour,
    quietEndHour: automation.quietEndHour,
    withdrawAction: automation.withdrawAction,
  };
}

export function annotatePreviewOos(
  projection: { available?: boolean; stock?: number },
  decision: OosDecision,
): PreviewOosAnnotation {
  return {
    oosPolicy: decision.policy,
    oosPolicySource: decision.source,
    oosRemoteAction: decision.remote,
    available: projection.available === true,
    stock: typeof projection.stock === 'number' ? projection.stock : null,
  };
}

export function isCanarySettings(settings?: Record<string, unknown> | null): boolean {
  return settings?.isCanary === true;
}

export function sanitizeDestinationSettings(input?: Record<string, unknown> | null): Record<string, unknown> {
  if (input == null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('settings مقصد نامعتبر است');
  }
  assertNoPlaintextSecrets(input);
  const keys = Object.keys(input);
  if (keys.some((key) => key !== 'isCanary')) {
    throw new BadRequestException('فقط isCanary در settings مقصد مجاز است');
  }
  if (input.isCanary === true) return { isCanary: true };
  if (input.isCanary === false || input.isCanary === undefined) return {};
  throw new BadRequestException('isCanary باید boolean باشد');
}

export function destinationSettingsForCanary(isCanary: boolean): Record<string, unknown> {
  return isCanary ? { isCanary: true } : {};
}

/** Canary toggle must not erase the server-written verification snapshot. */
export function mergeDestinationSettings(
  existing: Record<string, unknown> | null | undefined,
  isCanary: boolean,
): Record<string, unknown> {
  const verified = readDestinationVerification(existing);
  return { ...destinationSettingsForCanary(isCanary), ...(verified ? { verified } : {}) };
}

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/[\u0000-\u001F<>]/g, '').trim().slice(0, max);
  return text || undefined;
}

export function sanitizeDestinationVerification(input: unknown): DestinationVerification | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const checkedAt = typeof raw.checkedAt === 'string' && !Number.isNaN(Date.parse(raw.checkedAt))
    ? new Date(raw.checkedAt).toISOString()
    : new Date().toISOString();
  const out: DestinationVerification = { checkedAt, ok: raw.ok === true };
  const error = cleanText(raw.error, 60);
  if (error) out.error = error;
  const chatType = cleanText(raw.chatType, 20);
  if (chatType && /^[a-z_]+$/.test(chatType)) out.chatType = chatType;
  const title = cleanText(raw.title, 120);
  if (title) out.title = title;
  if (typeof raw.username === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(raw.username)) {
    out.username = raw.username;
  } else if (raw.username === null) {
    out.username = null;
  }
  if (typeof raw.memberCount === 'number' && Number.isFinite(raw.memberCount) && raw.memberCount >= 0) {
    out.memberCount = Math.floor(raw.memberCount);
  } else if (raw.memberCount === null) {
    out.memberCount = null;
  }
  for (const key of ['botIsAdmin', 'canPost', 'canEdit', 'canDelete'] as const) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key] as boolean;
  }
  if (raw.permissionCheck === 'api' || raw.permissionCheck === 'test_post' || raw.permissionCheck === 'unavailable') {
    out.permissionCheck = raw.permissionCheck;
  }
  if (typeof raw.testPostAt === 'string' && !Number.isNaN(Date.parse(raw.testPostAt))) {
    out.testPostAt = new Date(raw.testPostAt).toISOString();
  }
  return out;
}

/**
 * A successful admin test post proves the bot can publish where getChatMember does not exist
 * (Rubika). Keeps the getChat snapshot and flips canPost; edit/delete stay unknown until tried.
 */
export function withTestPostProof(
  settings: Record<string, unknown> | null | undefined,
  at: Date = new Date(),
): Record<string, unknown> {
  const current = readDestinationVerification(settings) || { checkedAt: at.toISOString(), ok: true };
  return withDestinationVerification(settings, {
    ...current,
    ok: true,
    error: undefined,
    canPost: true,
    permissionCheck: current.permissionCheck === 'api' ? 'api' : 'test_post',
    testPostAt: at.toISOString(),
  });
}

export function readDestinationVerification(
  settings: Record<string, unknown> | null | undefined,
): DestinationVerification | null {
  return sanitizeDestinationVerification(settings?.verified);
}

export function withDestinationVerification(
  settings: Record<string, unknown> | null | undefined,
  verification: DestinationVerification,
): Record<string, unknown> {
  const base = settings?.isCanary === true ? { isCanary: true } : {};
  const verified = sanitizeDestinationVerification(verification);
  return verified ? { ...base, verified } : base;
}

/** Live (non-canary) channel posting needs a verified bot with post rights. Private canary chats pass. */
export function destinationCanPost(settings: Record<string, unknown> | null | undefined): boolean {
  const verified = readDestinationVerification(settings);
  if (!verified || !verified.ok) return false;
  if (verified.chatType === 'private') return true;
  return verified.canPost === true;
}

/**
 * Enabled canary destinations on ACTIVE connections for one sales channel. Any official provider
 * qualifies (Telegram, Bale, Rubika); pass `provider` to restrict to one bot platform.
 */
export function selectCanaryDestinations<
  D extends { id: string; connectionId: string; enabled: boolean; settings?: Record<string, unknown> | null },
  C extends { id: string; provider: string; channel: string; status: string },
>(dests: D[], conns: C[], channel: string, provider?: string): D[] {
  const byId = new Map(conns.map((row) => [row.id, row]));
  return dests.filter((dest) => {
    if (!dest.enabled || !isCanarySettings(dest.settings)) return false;
    const conn = byId.get(dest.connectionId);
    return !!conn
      && isOmnichannelProvider(conn.provider)
      && (!provider || conn.provider === provider)
      && conn.channel === channel
      && conn.status === 'ACTIVE';
  });
}

/** @deprecated name kept for phase specs; same as selectCanaryDestinations(…, 'TELEGRAM'). */
export const selectCanaryTelegramDestinations = <
  D extends { id: string; connectionId: string; enabled: boolean; settings?: Record<string, unknown> | null },
  C extends { id: string; provider: string; channel: string; status: string },
>(dests: D[], conns: C[], channel: string): D[] => selectCanaryDestinations(dests, conns, channel, 'TELEGRAM');

/** One canary per (provider, sales channel). Default provider keeps the legacy Telegram lookup. */
export function findCanaryDestinationId<
  D extends { id: string; connectionId: string; settings?: Record<string, unknown> | null },
  C extends { id: string; provider: string; channel: string },
>(dests: D[], conns: C[], channel: 'RETAIL' | 'WHOLESALE', provider = 'TELEGRAM'): string | null {
  const byId = new Map(conns.map((row) => [row.id, row]));
  const match = dests.find((dest) => {
    if (!isCanarySettings(dest.settings)) return false;
    const conn = byId.get(dest.connectionId);
    return !!conn && conn.provider === provider && conn.channel === channel;
  });
  return match?.id ?? null;
}

/** Canary destination ids per provider for one sales channel: `{ TELEGRAM: id|null, BALE: …, RUBIKA: … }`. */
export function canaryDestinationIdsByProvider<
  D extends { id: string; connectionId: string; settings?: Record<string, unknown> | null },
  C extends { id: string; provider: string; channel: string },
>(dests: D[], conns: C[], channel: 'RETAIL' | 'WHOLESALE'): Record<OmnichannelProvider, string | null> {
  const out = {} as Record<OmnichannelProvider, string | null>;
  for (const provider of OMNICHANNEL_PROVIDERS) out[provider] = findCanaryDestinationId(dests, conns, channel, provider);
  return out;
}

export function assertAllowedSecretRefName(name: string): void {
  if (!isAllowedSecretRef(name) || looksLikeToken(name)) {
    throw new BadRequestException('secretRef باید نام env باشد نه مقدار secret');
  }
}

function looksLikeToken(value: string): boolean {
  return /\d{6,}:[A-Za-z0-9_-]{20,}/.test(value) || value === 'DATABASE_URL';
}

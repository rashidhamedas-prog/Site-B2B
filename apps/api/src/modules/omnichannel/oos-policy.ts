import { BadRequestException } from '@nestjs/common';
import {
  AUTO_PUBLISH_CANDIDATE_EVENTS,
  DEFAULT_OUTBOX_RETENTION_DAYS,
  DEFAULT_RETRY_SLA_SECONDS,
  OOS_POLICIES,
  OUTBOX_RETENTION_MAX_DAYS,
  OUTBOX_RETENTION_MIN_DAYS,
  RETRY_SLA_MAX_SECONDS,
  RETRY_SLA_MIN_SECONDS,
  type AutoPublishEventType,
  type OosPolicy,
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
  'reason',
]);

const AUTO_PUBLISH_EVENT_SET = new Set<string>(AUTO_PUBLISH_CANDIDATE_EVENTS);

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

export function mergeOmnichannelSettingsPatch(
  previous: StoredOmnichannelSettings,
  patch: {
    retailOosPolicy?: OosPolicy;
    wholesaleOosPolicy?: OosPolicy;
    autoPublishEventTypes?: string[];
    retrySlaSeconds?: number;
    outboxRetentionDays?: number;
  },
): StoredOmnichannelSettings {
  const next: StoredOmnichannelSettings = { ...previous };
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

export function publicOmnichannelSettings(
  stored: StoredOmnichannelSettings,
  canaries: { retail: string | null; wholesale: string | null },
) {
  const retail = readChannelOos(stored, 'RETAIL');
  const wholesale = readChannelOos(stored, 'WHOLESALE');
  const events = readAutoPublishEventTypes(stored);
  const retry = readRetrySlaSeconds(stored);
  const retention = readOutboxRetentionDays(stored);
  return {
    retailOosPolicy: retail.policy,
    wholesaleOosPolicy: wholesale.policy,
    retailOosChosen: retail.chosen,
    wholesaleOosChosen: wholesale.chosen,
    retailCanaryDestinationId: canaries.retail,
    wholesaleCanaryDestinationId: canaries.wholesale,
    autoPublishEventTypes: events.events,
    autoPublishEventTypesChosen: events.chosen,
    retrySlaSeconds: retry.seconds,
    retrySlaChosen: retry.chosen,
    outboxRetentionDays: retention.days,
    outboxRetentionChosen: retention.chosen,
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

export function selectCanaryTelegramDestinations<
  D extends { id: string; connectionId: string; enabled: boolean; settings?: Record<string, unknown> | null },
  C extends { id: string; provider: string; channel: string; status: string },
>(dests: D[], conns: C[], channel: string): D[] {
  const byId = new Map(conns.map((row) => [row.id, row]));
  return dests.filter((dest) => {
    if (!dest.enabled || !isCanarySettings(dest.settings)) return false;
    const conn = byId.get(dest.connectionId);
    return !!conn
      && conn.provider === 'TELEGRAM'
      && conn.channel === channel
      && conn.status === 'ACTIVE';
  });
}

export function findCanaryDestinationId<
  D extends { id: string; connectionId: string; settings?: Record<string, unknown> | null },
  C extends { id: string; provider: string; channel: string },
>(dests: D[], conns: C[], channel: 'RETAIL' | 'WHOLESALE'): string | null {
  const byId = new Map(conns.map((row) => [row.id, row]));
  const match = dests.find((dest) => {
    if (!isCanarySettings(dest.settings)) return false;
    const conn = byId.get(dest.connectionId);
    return !!conn && conn.provider === 'TELEGRAM' && conn.channel === channel;
  });
  return match?.id ?? null;
}

export function assertAllowedSecretRefName(name: string): void {
  if (!isAllowedSecretRef(name) || looksLikeToken(name)) {
    throw new BadRequestException('secretRef باید نام env باشد نه مقدار secret');
  }
}

function looksLikeToken(value: string): boolean {
  return /\d{6,}:[A-Za-z0-9_-]{20,}/.test(value) || value === 'DATABASE_URL';
}

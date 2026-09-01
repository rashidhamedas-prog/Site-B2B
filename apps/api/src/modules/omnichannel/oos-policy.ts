import { BadRequestException } from '@nestjs/common';
import { OOS_POLICIES, type OosPolicy } from './omnichannel.constants';
import { assertNoPlaintextSecrets, isAllowedSecretRef } from './omnichannel-secrets';

export { OOS_POLICIES, type OosPolicy };

export const OMNICHANNEL_SETTINGS_KEY = 'omnichannel';
export const DEFAULT_OOS_POLICY: OosPolicy = 'UPDATE';

export type StoredOmnichannelSettings = {
  retailOosPolicy?: OosPolicy;
  wholesaleOosPolicy?: OosPolicy;
  retailOosChosen?: boolean;
  wholesaleOosChosen?: boolean;
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

const SETTINGS_INPUT_KEYS = new Set(['retailOosPolicy', 'wholesaleOosPolicy', 'reason']);

export function isOosPolicy(value: unknown): value is OosPolicy {
  return value === 'UPDATE' || value === 'HIDE' || value === 'DELETE';
}

export function parseOosPolicy(value: unknown): OosPolicy | null {
  return isOosPolicy(value) ? value : null;
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
}

export function mergeOmnichannelSettingsPatch(
  previous: StoredOmnichannelSettings,
  patch: { retailOosPolicy?: OosPolicy; wholesaleOosPolicy?: OosPolicy },
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
  return parseStoredOmnichannelSettings(next);
}

export function publicOmnichannelSettings(
  stored: StoredOmnichannelSettings,
  canaries: { retail: string | null; wholesale: string | null },
) {
  const retail = readChannelOos(stored, 'RETAIL');
  const wholesale = readChannelOos(stored, 'WHOLESALE');
  return {
    retailOosPolicy: retail.policy,
    wholesaleOosPolicy: wholesale.policy,
    retailOosChosen: retail.chosen,
    wholesaleOosChosen: wholesale.chosen,
    retailCanaryDestinationId: canaries.retail,
    wholesaleCanaryDestinationId: canaries.wholesale,
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

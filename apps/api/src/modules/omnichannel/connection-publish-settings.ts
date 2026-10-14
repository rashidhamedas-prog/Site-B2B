/**
 * Per-bot × platform publish settings live on ChannelConnection.publishSettings.
 * A connection already encodes (provider, salesChannel, bot name).
 * Global app_settings.omnichannel keeps only worker leftovers (retry SLA, retention)
 * and legacy fields used as one-time fallback until a connection is seeded.
 */
import {
  AUTO_DAILY_CAP_MAX,
  AUTO_DAILY_CAP_MIN,
  AUTO_MIN_GAP_MAX_SECONDS,
  AUTO_MIN_GAP_MIN_SECONDS,
  DEFAULT_AUTO_DAILY_CAP,
  DEFAULT_AUTO_MIN_GAP_SECONDS,
  DEFAULT_AUTO_PUBLISH_MODE,
  DEFAULT_WITHDRAW_ACTION,
  type AutoPublishEventType,
  type AutoPublishMode,
  type OosPolicy,
  type WithdrawAction,
} from './omnichannel.constants';
import {
  DEFAULT_OOS_POLICY,
  isAutoPublishMode,
  isOosPolicy,
  isWithdrawAction,
  parseAutoPublishCategoryIds,
  parseAutoPublishEventTypes,
  parseBoundedInt,
  readAutoPublishCategoryIds,
  readAutoPublishEventTypes,
  readAutomationSettings,
  type AutomationSettings,
  type StoredOmnichannelSettings,
} from './oos-policy';
import { assertNoPlaintextSecrets } from './omnichannel-secrets';

export type ConnectionPublishSettings = {
  oosPolicy?: OosPolicy;
  oosChosen?: boolean;
  autoPublishEventTypes?: AutoPublishEventType[];
  autoPublishEventTypesChosen?: boolean;
  autoPublishMode?: AutoPublishMode;
  autoDailyCap?: number;
  autoMinGapSeconds?: number;
  quietStartHour?: number;
  quietEndHour?: number;
  withdrawAction?: WithdrawAction;
  autoPublishCategoryIds?: string[];
  /** Set when admin saved this connection's publish rules at least once. */
  seeded?: boolean;
};

export type ResolvedConnectionPublish = {
  oosPolicy: OosPolicy;
  oosChosen: boolean;
  events: AutoPublishEventType[];
  eventsChosen: boolean;
  automation: AutomationSettings;
  categoryIds: string[];
  source: 'connection' | 'global_fallback';
};

const PUBLISH_INPUT_KEYS = new Set([
  'oosPolicy',
  'autoPublishEventTypes',
  'autoPublishMode',
  'autoDailyCap',
  'autoMinGapSeconds',
  'quietStartHour',
  'quietEndHour',
  'withdrawAction',
  'autoPublishCategoryIds',
  'reason',
]);

function parseHourOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return parseBoundedInt(value, 0, 23) ?? undefined;
}

export function parseConnectionPublishSettings(value: unknown): ConnectionPublishSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const out: ConnectionPublishSettings = {};
  if (isOosPolicy(raw.oosPolicy)) out.oosPolicy = raw.oosPolicy;
  if (raw.oosChosen === true && out.oosPolicy) out.oosChosen = true;
  const events = parseAutoPublishEventTypes(raw.autoPublishEventTypes);
  if (events && raw.autoPublishEventTypesChosen === true) {
    out.autoPublishEventTypes = events;
    out.autoPublishEventTypesChosen = true;
  }
  if (isAutoPublishMode(raw.autoPublishMode)) out.autoPublishMode = raw.autoPublishMode;
  const cap = parseBoundedInt(raw.autoDailyCap, AUTO_DAILY_CAP_MIN, AUTO_DAILY_CAP_MAX);
  if (cap != null) out.autoDailyCap = cap;
  const gap = parseBoundedInt(raw.autoMinGapSeconds, AUTO_MIN_GAP_MIN_SECONDS, AUTO_MIN_GAP_MAX_SECONDS);
  if (gap != null) out.autoMinGapSeconds = gap;
  const quietStart = parseHourOrNull(raw.quietStartHour);
  const quietEnd = parseHourOrNull(raw.quietEndHour);
  if (typeof quietStart === 'number') out.quietStartHour = quietStart;
  if (typeof quietEnd === 'number') out.quietEndHour = quietEnd;
  if (quietStart === null) delete out.quietStartHour;
  if (quietEnd === null) delete out.quietEndHour;
  if (isWithdrawAction(raw.withdrawAction)) out.withdrawAction = raw.withdrawAction;
  const cats = parseAutoPublishCategoryIds(raw.autoPublishCategoryIds);
  if (cats) out.autoPublishCategoryIds = cats;
  if (raw.seeded === true) out.seeded = true;
  return out;
}

export function assertConnectionPublishSettingsInput(input: unknown): void {
  assertNoPlaintextSecrets(input);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('invalid_publish_settings');
  }
  const raw = input as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!PUBLISH_INPUT_KEYS.has(key)) throw new Error(`unknown_publish_field:${key}`);
  }
  if (raw.oosPolicy !== undefined && !isOosPolicy(raw.oosPolicy)) throw new Error('invalid_oos');
  if (raw.autoPublishMode !== undefined && !isAutoPublishMode(raw.autoPublishMode)) {
    throw new Error('invalid_auto_mode');
  }
  if (raw.autoPublishEventTypes !== undefined && !parseAutoPublishEventTypes(raw.autoPublishEventTypes)) {
    throw new Error('invalid_events');
  }
  if (raw.autoDailyCap !== undefined && parseBoundedInt(raw.autoDailyCap, AUTO_DAILY_CAP_MIN, AUTO_DAILY_CAP_MAX) == null) {
    throw new Error('invalid_daily_cap');
  }
  if (
    raw.autoMinGapSeconds !== undefined
    && parseBoundedInt(raw.autoMinGapSeconds, AUTO_MIN_GAP_MIN_SECONDS, AUTO_MIN_GAP_MAX_SECONDS) == null
  ) {
    throw new Error('invalid_min_gap');
  }
  if (raw.quietStartHour !== undefined && raw.quietStartHour !== null && parseBoundedInt(raw.quietStartHour, 0, 23) == null) {
    throw new Error('invalid_quiet_start');
  }
  if (raw.quietEndHour !== undefined && raw.quietEndHour !== null && parseBoundedInt(raw.quietEndHour, 0, 23) == null) {
    throw new Error('invalid_quiet_end');
  }
  if (raw.withdrawAction !== undefined && !isWithdrawAction(raw.withdrawAction)) {
    throw new Error('invalid_withdraw');
  }
  if (raw.autoPublishCategoryIds !== undefined && parseAutoPublishCategoryIds(raw.autoPublishCategoryIds) == null) {
    throw new Error('invalid_categories');
  }
}

export type ConnectionPublishPatch = {
  oosPolicy?: string;
  autoPublishEventTypes?: string[];
  autoPublishMode?: string;
  autoDailyCap?: number;
  autoMinGapSeconds?: number;
  quietStartHour?: number | null;
  quietEndHour?: number | null;
  withdrawAction?: string;
  autoPublishCategoryIds?: string[];
};

export function hasConnectionPublishPatch(patch: ConnectionPublishPatch): boolean {
  return patch.oosPolicy !== undefined
    || patch.autoPublishEventTypes !== undefined
    || patch.autoPublishMode !== undefined
    || patch.autoDailyCap !== undefined
    || patch.autoMinGapSeconds !== undefined
    || patch.quietStartHour !== undefined
    || patch.quietEndHour !== undefined
    || patch.withdrawAction !== undefined
    || patch.autoPublishCategoryIds !== undefined;
}

export function mergeConnectionPublishSettingsPatch(
  previous: ConnectionPublishSettings,
  patch: ConnectionPublishPatch,
): ConnectionPublishSettings {
  const next: ConnectionPublishSettings = { ...previous, seeded: true };
  if (isOosPolicy(patch.oosPolicy)) {
    next.oosPolicy = patch.oosPolicy;
    next.oosChosen = true;
  }
  const events = parseAutoPublishEventTypes(patch.autoPublishEventTypes);
  if (events) {
    next.autoPublishEventTypes = events;
    next.autoPublishEventTypesChosen = true;
  }
  if (isAutoPublishMode(patch.autoPublishMode)) next.autoPublishMode = patch.autoPublishMode;
  const cap = parseBoundedInt(patch.autoDailyCap, AUTO_DAILY_CAP_MIN, AUTO_DAILY_CAP_MAX);
  if (cap != null) next.autoDailyCap = cap;
  const gap = parseBoundedInt(patch.autoMinGapSeconds, AUTO_MIN_GAP_MIN_SECONDS, AUTO_MIN_GAP_MAX_SECONDS);
  if (gap != null) next.autoMinGapSeconds = gap;
  const quietStart = parseHourOrNull(patch.quietStartHour);
  const quietEnd = parseHourOrNull(patch.quietEndHour);
  if (quietStart === null) delete next.quietStartHour;
  else if (typeof quietStart === 'number') next.quietStartHour = quietStart;
  if (quietEnd === null) delete next.quietEndHour;
  else if (typeof quietEnd === 'number') next.quietEndHour = quietEnd;
  if (isWithdrawAction(patch.withdrawAction)) next.withdrawAction = patch.withdrawAction;
  const cats = parseAutoPublishCategoryIds(patch.autoPublishCategoryIds);
  if (cats) next.autoPublishCategoryIds = cats;
  return parseConnectionPublishSettings(next);
}

/** Copy legacy global automation/OOS into a new connection row (one-time seed). */
export function seedConnectionPublishFromGlobal(
  global: StoredOmnichannelSettings,
  channel: 'RETAIL' | 'WHOLESALE',
): ConnectionPublishSettings {
  const automation = readAutomationSettings(global);
  const events = readAutoPublishEventTypes(global);
  const oosPolicy = channel === 'RETAIL' ? global.retailOosPolicy : global.wholesaleOosPolicy;
  const oosChosen = channel === 'RETAIL' ? global.retailOosChosen === true : global.wholesaleOosChosen === true;
  const out: ConnectionPublishSettings = {
    autoPublishMode: automation.mode,
    autoDailyCap: automation.dailyCap,
    autoMinGapSeconds: automation.minGapSeconds,
    withdrawAction: automation.withdrawAction,
    autoPublishCategoryIds: readAutoPublishCategoryIds(global),
    seeded: false,
  };
  if (automation.quietStartHour != null) out.quietStartHour = automation.quietStartHour;
  if (automation.quietEndHour != null) out.quietEndHour = automation.quietEndHour;
  if (events.chosen) {
    out.autoPublishEventTypes = events.events;
    out.autoPublishEventTypesChosen = true;
  }
  if (isOosPolicy(oosPolicy)) {
    out.oosPolicy = oosPolicy;
    if (oosChosen) out.oosChosen = true;
  }
  return parseConnectionPublishSettings(out);
}

export function resolveConnectionPublishSettings(
  storedOnConn: unknown,
  globalFallback: StoredOmnichannelSettings,
  channel: 'RETAIL' | 'WHOLESALE',
): ResolvedConnectionPublish {
  const local = parseConnectionPublishSettings(storedOnConn);
  const useLocal = local.seeded === true
    || local.autoPublishMode != null
    || local.oosChosen === true
    || local.autoPublishEventTypesChosen === true
    || Array.isArray(local.autoPublishCategoryIds);
  if (!useLocal) {
    const seeded = seedConnectionPublishFromGlobal(globalFallback, channel);
    return {
      ...resolveFromParsed(seeded, channel),
      source: 'global_fallback',
    };
  }
  return { ...resolveFromParsed(local, channel), source: 'connection' };
}

function resolveFromParsed(
  local: ConnectionPublishSettings,
  _channel: 'RETAIL' | 'WHOLESALE',
): Omit<ResolvedConnectionPublish, 'source'> {
  const quietStart = typeof local.quietStartHour === 'number' ? local.quietStartHour : null;
  const quietEnd = typeof local.quietEndHour === 'number' ? local.quietEndHour : null;
  const both = quietStart != null && quietEnd != null && quietStart !== quietEnd;
  const automation: AutomationSettings = {
    mode: isAutoPublishMode(local.autoPublishMode) ? local.autoPublishMode : DEFAULT_AUTO_PUBLISH_MODE,
    dailyCap: typeof local.autoDailyCap === 'number' ? local.autoDailyCap : DEFAULT_AUTO_DAILY_CAP,
    minGapSeconds: typeof local.autoMinGapSeconds === 'number' ? local.autoMinGapSeconds : DEFAULT_AUTO_MIN_GAP_SECONDS,
    quietStartHour: both ? quietStart : null,
    quietEndHour: both ? quietEnd : null,
    withdrawAction: isWithdrawAction(local.withdrawAction) ? local.withdrawAction : DEFAULT_WITHDRAW_ACTION,
  };
  const eventsChosen = local.autoPublishEventTypesChosen === true && local.autoPublishEventTypes
    ? { events: local.autoPublishEventTypes, chosen: true as const }
    : { events: [] as AutoPublishEventType[], chosen: false as const };
  return {
    oosPolicy: local.oosChosen === true && isOosPolicy(local.oosPolicy) ? local.oosPolicy : DEFAULT_OOS_POLICY,
    oosChosen: local.oosChosen === true,
    events: eventsChosen.events,
    eventsChosen: eventsChosen.chosen,
    automation,
    categoryIds: Array.isArray(local.autoPublishCategoryIds) ? local.autoPublishCategoryIds : [],
  };
}

export function publicConnectionPublishSettings(resolved: ResolvedConnectionPublish) {
  return {
    oosPolicy: resolved.oosPolicy,
    oosChosen: resolved.oosChosen,
    autoPublishEventTypes: resolved.events,
    autoPublishEventTypesChosen: resolved.eventsChosen,
    autoPublishMode: resolved.automation.mode,
    autoDailyCap: resolved.automation.dailyCap,
    autoMinGapSeconds: resolved.automation.minGapSeconds,
    quietStartHour: resolved.automation.quietStartHour,
    quietEndHour: resolved.automation.quietEndHour,
    withdrawAction: resolved.automation.withdrawAction,
    autoPublishCategoryIds: resolved.categoryIds,
    settingsSource: resolved.source,
  };
}

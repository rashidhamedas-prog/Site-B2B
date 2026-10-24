/**
 * Per-destination publish settings (primary operator scope).
 * Resolution: destination.publishSettings → connection.publishSettings (compat) → global seed.
 * Connection remains bot credentials + fallback seed only.
 */
import {
  assertConnectionPublishSettingsInput,
  hasConnectionPublishPatch,
  mergeConnectionPublishSettingsPatch,
  parseConnectionPublishSettings,
  publicConnectionPublishSettings,
  resolveConnectionPublishSettings,
  type ConnectionPublishPatch,
  type ConnectionPublishSettings,
  type ResolvedConnectionPublish,
} from './connection-publish-settings';
import type { StoredOmnichannelSettings } from './oos-policy';

export type DestinationPublishSettings = ConnectionPublishSettings;
export type DestinationPublishPatch = ConnectionPublishPatch;

export type ResolvedDestinationPublish = Omit<ResolvedConnectionPublish, 'source'> & {
  source: 'destination' | 'connection' | 'global_fallback';
};

export const assertDestinationPublishSettingsInput = assertConnectionPublishSettingsInput;
export const hasDestinationPublishPatch = hasConnectionPublishPatch;
export const mergeDestinationPublishSettingsPatch = mergeConnectionPublishSettingsPatch;
export const parseDestinationPublishSettings = parseConnectionPublishSettings;

export function resolveDestinationPublishSettings(
  storedOnDest: unknown,
  storedOnConn: unknown,
  globalFallback: StoredOmnichannelSettings,
  channel: 'RETAIL' | 'WHOLESALE',
): ResolvedDestinationPublish {
  const local = parseConnectionPublishSettings(storedOnDest);
  const useLocal = local.seeded === true
    || local.autoPublishMode != null
    || local.oosChosen === true
    || local.autoPublishEventTypesChosen === true
    || Array.isArray(local.autoPublishCategoryIds);
  if (useLocal) {
    const resolved = resolveConnectionPublishSettings(local, globalFallback, channel);
    return { ...resolved, source: 'destination' };
  }
  const fromConn = resolveConnectionPublishSettings(storedOnConn, globalFallback, channel);
  return {
    ...fromConn,
    source: fromConn.source === 'connection' ? 'connection' : 'global_fallback',
  };
}

export function publicDestinationPublishSettings(resolved: ResolvedDestinationPublish) {
  const base = publicConnectionPublishSettings({
    ...resolved,
    source: resolved.source === 'global_fallback' ? 'global_fallback' : 'connection',
  });
  return { ...base, settingsSource: resolved.source };
}

/** Seed a new destination from its parent connection blob (or global via connection resolve). */
export function seedDestinationPublishFromConnection(
  storedOnConn: unknown,
  globalFallback: StoredOmnichannelSettings,
  channel: 'RETAIL' | 'WHOLESALE',
): DestinationPublishSettings {
  const resolved = resolveConnectionPublishSettings(storedOnConn, globalFallback, channel);
  return parseConnectionPublishSettings({
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
    seeded: false,
  });
}

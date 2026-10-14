/**
 * npx ts-node --transpile-only src/modules/omnichannel/connection-publish-settings.spec.ts
 */
import {
  assertConnectionPublishSettingsInput,
  hasConnectionPublishPatch,
  mergeConnectionPublishSettingsPatch,
  publicConnectionPublishSettings,
  resolveConnectionPublishSettings,
  seedConnectionPublishFromGlobal,
} from './connection-publish-settings';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const global = {
  autoPublishMode: 'LIVE' as const,
  autoDailyCap: 12,
  autoMinGapSeconds: 60,
  withdrawAction: 'KEEP' as const,
  wholesaleOosPolicy: 'HIDE' as const,
  wholesaleOosChosen: true,
  autoPublishEventTypes: ['product.created' as const],
  autoPublishEventTypesChosen: true,
  autoPublishCategoryIds: ['11111111-1111-4111-8111-111111111111'],
};

const seeded = seedConnectionPublishFromGlobal(global, 'WHOLESALE');
assert(seeded.autoPublishMode === 'LIVE' && seeded.oosPolicy === 'HIDE', 'seed copies wholesale OOS + mode');
assert(seeded.autoPublishCategoryIds?.length === 1, 'seed copies category allowlist');

const emptyResolved = resolveConnectionPublishSettings({}, global, 'WHOLESALE');
assert(emptyResolved.source === 'global_fallback', 'empty conn falls back to global');
assert(emptyResolved.automation.mode === 'LIVE', 'fallback mode');

const localResolved = resolveConnectionPublishSettings(
  { seeded: true, autoPublishMode: 'CANARY', autoDailyCap: 3, oosPolicy: 'DELETE', oosChosen: true },
  global,
  'WHOLESALE',
);
assert(localResolved.source === 'connection', 'seeded conn uses local');
assert(localResolved.automation.mode === 'CANARY' && localResolved.automation.dailyCap === 3, 'local automation');
assert(localResolved.oosPolicy === 'DELETE', 'local OOS');

const otherBot = resolveConnectionPublishSettings(
  { seeded: true, autoPublishMode: 'OFF' },
  global,
  'WHOLESALE',
);
assert(otherBot.automation.mode === 'OFF' && localResolved.automation.mode === 'CANARY', 'bots isolate modes');

assert(hasConnectionPublishPatch({ autoPublishMode: 'OFF' }), 'patch detector');
const merged = mergeConnectionPublishSettingsPatch({}, { autoPublishMode: 'CANARY', oosPolicy: 'UPDATE' });
assert(merged.seeded === true && merged.autoPublishMode === 'CANARY' && merged.oosChosen === true, 'merge marks seeded');

try {
  assertConnectionPublishSettingsInput({ token: 'x' });
  assert(false, 'must reject secrets');
} catch {
  /* expected */
}

const pub = publicConnectionPublishSettings(localResolved);
assert(pub.settingsSource === 'connection' && pub.autoPublishMode === 'CANARY', 'public shape');

console.log('connection-publish-settings.spec.ts: ok');

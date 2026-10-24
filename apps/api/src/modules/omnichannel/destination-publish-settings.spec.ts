/**
 * npx ts-node --transpile-only src/modules/omnichannel/destination-publish-settings.spec.ts
 */
import {
  assertDestinationPublishSettingsInput,
  publicDestinationPublishSettings,
  resolveDestinationPublishSettings,
  seedDestinationPublishFromConnection,
} from './destination-publish-settings';

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

const connSeeded = {
  seeded: true,
  autoPublishMode: 'CANARY' as const,
  autoDailyCap: 5,
  oosPolicy: 'UPDATE' as const,
  oosChosen: true,
};

const emptyDest = resolveDestinationPublishSettings({}, connSeeded, global, 'WHOLESALE');
assert(emptyDest.source === 'connection', 'empty dest falls back to connection');
assert(emptyDest.automation.mode === 'CANARY' && emptyDest.automation.dailyCap === 5, 'connection mode/cap');

const destLocal = resolveDestinationPublishSettings(
  { seeded: true, autoPublishMode: 'OFF', autoDailyCap: 2 },
  connSeeded,
  global,
  'WHOLESALE',
);
assert(destLocal.source === 'destination', 'seeded dest wins');
assert(destLocal.automation.mode === 'OFF' && destLocal.automation.dailyCap === 2, 'dest isolates from sibling');
assert(emptyDest.automation.mode === 'CANARY', 'sibling still on connection fallback');

const noConn = resolveDestinationPublishSettings({}, {}, global, 'WHOLESALE');
assert(noConn.source === 'global_fallback', 'empty dest+conn uses global');
assert(noConn.automation.mode === 'LIVE', 'global mode');

const seeded = seedDestinationPublishFromConnection(connSeeded, global, 'WHOLESALE');
assert(seeded.autoPublishMode === 'CANARY' && seeded.seeded !== true, 'seed copies connection without marking seeded');

try {
  assertDestinationPublishSettingsInput({ botToken: 'x' });
  assert(false, 'must reject secrets');
} catch {
  /* expected */
}

const pub = publicDestinationPublishSettings(destLocal);
assert(pub.settingsSource === 'destination' && pub.autoPublishMode === 'OFF', 'public shape');

console.log('destination-publish-settings.spec.ts: ok');

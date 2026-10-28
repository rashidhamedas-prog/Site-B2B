/**
 * npx ts-node --transpile-only src/modules/omnichannel/composer-plan.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  assertComposerSendAllowed,
  buildComposerPlan,
  composerQuietNowMessage,
} from './composer-plan';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(resolve(__dirname, 'composer-plan.ts'), 'utf8');
assert(!src.includes('fetch('), 'no fetch');
assert(!src.includes('TelegramAdapter'), 'no telegram adapter');
assert(!src.includes('BaleAdapter'), 'no bale adapter');
assert(!src.includes('RubikaAdapter'), 'no rubika adapter');
assert(!src.includes('OMNICHANNEL_CONNECTORS_ENABLED'), 'no connector flip');
assert(!src.includes('TELEGRAM_API_URL'), 'no egress');

const night = new Date('2026-10-28T21:00:00.000Z'); // ~00:30 Tehran
const day = new Date('2026-10-28T10:00:00.000Z'); // ~13:30 Tehran

{
  const plan = buildComposerPlan({
    destinations: [
      { destinationId: 'd1', channel: 'RETAIL', provider: 'BALE', dailyCap: 10, sentToday: 3 },
    ],
    liveRemote: [
      { destinationId: 'd1', publicationId: 'pub-1', providerMessageId: 'msg-9' },
    ],
    pendingCreates: new Set(),
    sendMode: 'next_slot',
    now: day,
  });
  assert(plan.destinations[0].action === 'UPDATE', 'UPDATE when live exists');
  assert(plan.destinations[0].liveHint?.providerMessageId === 'msg-9', 'liveHint');
  assert(plan.summary.updateCount === 1 && plan.summary.createCount === 0, 'summary UPDATE');
  assert(plan.destinations[0].capRemaining === 7, 'cap 3 of 10 → remaining 7');
}

{
  const plan = buildComposerPlan({
    destinations: [
      { destinationId: 'd2', channel: 'RETAIL', provider: 'TELEGRAM', dailyCap: 10, sentToday: 0 },
    ],
    liveRemote: [],
    pendingCreates: new Set(),
    sendMode: 'next_slot',
    now: day,
  });
  assert(plan.destinations[0].action === 'CREATE', 'CREATE when no live');
  assert(plan.summary.createCount === 1, 'summary CREATE');
}

{
  const plan = buildComposerPlan({
    destinations: [
      { destinationId: 'd3', channel: 'RETAIL', provider: 'RUBIKA', dailyCap: 10, sentToday: 0 },
    ],
    liveRemote: [],
    pendingCreates: new Set(['d3']),
    sendMode: 'next_slot',
    now: day,
  });
  assert(plan.destinations[0].action === 'SKIP', 'pending CREATE → SKIP');
  assert(plan.destinations[0].skipReason === 'pending_create', 'skipReason');
  assert(plan.summary.skipCount === 1, 'summary SKIP');
}

{
  const plan = buildComposerPlan({
    destinations: [
      {
        destinationId: 'd4',
        channel: 'RETAIL',
        provider: 'BALE',
        quietStartHour: 23,
        quietEndHour: 8,
        dailyCap: 10,
        sentToday: 0,
      },
    ],
    liveRemote: [],
    pendingCreates: new Set(),
    sendMode: 'now',
    now: night,
  });
  assert(plan.destinations[0].quietConflict === true, 'quiet «now» → conflict flag');
  assert(plan.summary.quietConflictCount === 1, 'quietConflictCount');
  try {
    assertComposerSendAllowed(plan, 'now');
    throw new Error('should throw');
  } catch (err) {
    assert(err instanceof Error && err.message === composerQuietNowMessage(), 'quiet now Persian 400');
  }
}

{
  const plan = buildComposerPlan({
    destinations: [
      {
        destinationId: 'd5',
        channel: 'RETAIL',
        provider: 'BALE',
        quietStartHour: 23,
        quietEndHour: 8,
        dailyCap: 10,
        sentToday: 0,
        minGapSeconds: 0,
      },
      {
        destinationId: 'd6',
        channel: 'RETAIL',
        provider: 'TELEGRAM',
        quietStartHour: 23,
        quietEndHour: 8,
        dailyCap: 10,
        sentToday: 1,
      },
    ],
    liveRemote: [
      { destinationId: 'd6', publicationId: 'p6', providerMessageId: 'm6' },
    ],
    pendingCreates: new Set(),
    sendMode: 'next_slot',
    now: night,
  });
  assert(plan.destinations.length === 2, 'multi-dest');
  assert(plan.destinations[0].action === 'CREATE' && plan.destinations[1].action === 'UPDATE', 'multi actions');
  assert(plan.destinations.every((d) => d.quietConflict === false), 'next_slot defers quiet');
  assert(Boolean(plan.destinations[0].slotAtTehran), 'slotAtTehran set');
}

console.log('composer-plan.spec.ts: ok');

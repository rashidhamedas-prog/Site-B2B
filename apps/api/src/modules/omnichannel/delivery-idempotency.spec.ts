/**
 * npx ts-node --transpile-only src/modules/omnichannel/delivery-idempotency.spec.ts
 * Decision tests only. No Bale/Rubika HTTP.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { tehranDayStart } from '../../lib/tehran-time';
import {
  buildIdempotencyKey,
  contentHash,
  dailyCapForProvider,
  decideCreateEnqueue,
  decideDailyCap,
  decideRetryAgainstSibling,
  decideSendWinner,
  isStaleDelivery,
  planCreateSend,
  publicationToReuse,
  type ExistingCreateRow,
} from './delivery-idempotency';
import { DEFAULT_AUTO_DAILY_CAP, DELIVERY_DEFERRED_REASONS } from './omnichannel.constants';
import { planManualDeliveries } from './publication-automation';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const dest = '4858359991';
const sourceId = '7150';

function row(partial: Partial<ExistingCreateRow> & Pick<ExistingCreateRow, 'id' | 'status'>): ExistingCreateRow {
  return {
    contentHash: null,
    providerMessageId: null,
    eventId: `evt-${partial.id}`,
    publicationId: 'pub-1',
    createdAt: new Date('2026-10-20T12:00:00.000Z'),
    ...partial,
  };
}

{
  assert(
    buildIdempotencyKey({ action: 'CREATE', sourceType: 'PRODUCT', sourceId, destinationId: dest })
      === `CREATE:PRODUCT:${sourceId}:${dest}`,
    'CREATE key ignores publication id',
  );
  const hash = contentHash({ text: 'سلام', photoUrls: ['a'], buttons: [{ label: 'خرید', url: 'https://example.com' }] });
  assert(hash.length === 64, 'content hash is sha256');
  assert(
    buildIdempotencyKey({
      action: 'UPDATE',
      sourceType: 'PRODUCT',
      sourceId,
      destinationId: dest,
      providerMessageId: 'm1',
      contentHash: hash,
    }) === `UPDATE:${dest}:m1:${hash}`,
    'UPDATE key includes message and hash',
  );
  assert(
    buildIdempotencyKey({
      action: 'DELETE',
      sourceType: 'PRODUCT',
      sourceId,
      destinationId: dest,
      providerMessageId: 'm1',
      contentHash: hash,
    }).startsWith(`DELETE:${dest}:m1:`),
    'DELETE key is scoped to the remote message',
  );
}

{
  const dead = row({ id: 'dead-1', status: 'DEAD', createdAt: new Date('2026-10-21T14:26:00.000Z') });
  const again = decideCreateEnqueue([dead], 'hash-new');
  assert(again.kind === 'reuse' && again.deliveryId === 'dead-1', 'DEAD row is reused (5047)');
  assert(decideRetryAgainstSibling({ deliveryId: 'dead-1', hasLiveSucceededSibling: false }) === 'retry', 'retry keeps the same row');
  const held = decideCreateEnqueue([row({
    id: 'hold-1',
    status: 'HOLD',
    deferredReason: 'uncertain_after_timeout',
    createdAt: new Date('2026-10-25T10:00:00.000Z'),
  })], 'hash-new');
  assert(held.kind === 'skip' && held.reason === 'hold_needs_reapproval', 'uncertain_after_timeout HOLD is not auto-reused');
  assert(DELIVERY_DEFERRED_REASONS.includes('uncertain_after_timeout'), 'deferred reason catalog includes timeout HOLD');
  assert(dailyCapForProvider('BALE', 0) === DEFAULT_AUTO_DAILY_CAP, 'empty autoDailyCap falls back to default 20');
  assert(dailyCapForProvider('BALE', 7) === 7, 'stored autoDailyCap wins');
  process.env.OMNICHANNEL_DAILY_CAP_BALE = '99';
  assert(dailyCapForProvider('BALE', 7) === 7, 'OMNICHANNEL_DAILY_CAP_* env must not override UI/DB cap');
  delete process.env.OMNICHANNEL_DAILY_CAP_BALE;
}

{
  const live = row({
    id: 'ok-1',
    status: 'SUCCEEDED',
    providerMessageId: 'm-live',
    contentHash: 'same',
    createdAt: new Date('2026-10-24T13:23:00.000Z'),
  });
  const oldDead = row({ id: 'old-dead', status: 'DEAD', createdAt: new Date('2026-10-22T08:00:00.000Z') });
  assert(decideCreateEnqueue([live, oldDead], 'same').kind === 'skip', 'same content does not create again');
  const changed = decideCreateEnqueue([live, oldDead], 'other');
  assert(changed.kind === 'convert_update' && changed.providerMessageId === 'm-live', 'changed content becomes UPDATE');
  assert(
    decideRetryAgainstSibling({ deliveryId: 'old-dead', hasLiveSucceededSibling: true }) === 'supersede',
    'revive of an old DEAD row is superseded when a CREATE already landed (7200)',
  );
  assert(
    decideSendWinner(
      { id: 'old-dead', createdAt: oldDead.createdAt },
      [{ id: 'ok-1', createdAt: live.createdAt, status: 'SUCCEEDED' }],
    ) === 'supersede',
    'worker does not send when a succeeded CREATE exists',
  );
}

{
  const first = decideCreateEnqueue([], 'h1');
  assert(first.kind === 'insert', 'first publish inserts');
  const pending = row({ id: 'p1', status: 'PENDING', contentHash: 'h1', createdAt: new Date('2026-10-25T08:00:00.000Z') });
  const second = decideCreateEnqueue([pending], 'h2');
  assert(second.kind === 'merge' && second.deliveryId === 'p1', 'manual and auto share one in-flight row');
}

{
  const plan = planManualDeliveries(['d-dead'], [], new Set());
  assert(plan.creates.length === 1 && plan.creates[0].destinationId === 'd-dead', 'DEAD is not pending, so enqueue can reuse it');
  const inflight = planManualDeliveries(['d-wait'], [], new Set(['d-wait']));
  assert(inflight.creates.some((item) => item.destinationId === 'd-wait'), 'in-flight CREATE is handed back for merge');
}

{
  const full = decideDailyCap({
    sentToday: 20,
    inFlight: 0,
    cap: 20,
    now: new Date('2026-10-25T20:29:30.000Z'),
    quietEndHour: 8,
    jitterMs: 0,
  });
  assert(full.allow === false, '23:59:30 Tehran with a full cap defers');
  if (!full.allow && full.availableAt) {
    assert(full.availableAt.toISOString() === '2026-10-26T04:30:00.000Z', 'defer lands at 08:00 Tehran next day, not UTC midnight');
    const tehranMidnight = tehranDayStart(new Date('2026-10-25T20:29:30.000Z'));
    assert(tehranMidnight.toISOString() === '2026-10-24T20:30:00.000Z', 'Tehran day starts at 20:30 UTC');
  }
  const nextMorning = decideDailyCap({
    sentToday: 0,
    inFlight: 1,
    cap: 20,
    now: new Date('2026-10-25T20:30:05.000Z'),
    quietEndHour: 8,
    jitterMs: 0,
  });
  assert(nextMorning.allow === true, '00:00:05 Tehran with room under the cap allows');
}

{
  const now = new Date('2026-10-25T12:00:00.000Z');
  assert(isStaleDelivery(new Date('2026-10-23T11:00:00.000Z'), null, now, 24) === true, 'older than 24h is stale');
  assert(isStaleDelivery(new Date('2026-10-23T11:00:00.000Z'), new Date('2026-10-25T11:30:00.000Z'), now, 24) === false, 'reapproval refreshes the clock');
  const held = planCreateSend({
    now,
    createdAt: new Date('2026-10-20T12:00:00.000Z'),
    reapprovedAt: null,
    staleHours: 24,
    sentToday: 0,
    inFlight: 0,
    cap: 20,
    lastSentAt: null,
    minGapSeconds: 60,
    sendsLastMinute: 0,
    maxPerMinute: 2,
    quietEndHour: null,
    jitterMs: 0,
    winner: 'send',
  });
  assert(held.kind === 'hold', 'stale CREATE is held before it can spend cap');
}

{
  type Item = { id: string; key: string; createdAt: Date; status: 'PENDING' | 'DEAD' | 'SUCCEEDED' | 'HOLD' };
  const start = new Date('2026-10-25T08:00:00.000Z');
  const items: Item[] = [{
    id: 'old',
    key: 'old',
    createdAt: new Date(start.getTime() - 48 * 3_600_000),
    status: 'PENDING',
  }];
  for (let i = 0; i < 30; i += 1) {
    items.push({
      id: `n-${i}`,
      key: `k-${i}`,
      createdAt: new Date(start.getTime() + i * 60_000),
      status: 'PENDING',
    });
  }
  items.push({
    id: 'dup',
    key: 'k-0',
    createdAt: new Date(start.getTime() + 45 * 60_000),
    status: 'DEAD',
  });
  const adapter: string[] = [];
  let sentToday = 0;
  let lastSent: Date | null = null;
  let clock = start;
  const sentKeys = new Set<string>();
  const ordered = [...items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const item of ordered) {
    if (sentKeys.has(item.key) || items.some((other) => other.key === item.key && other.status === 'SUCCEEDED')) {
      item.status = 'DEAD';
      continue;
    }
    const plan = planCreateSend({
      now: clock,
      createdAt: item.createdAt,
      reapprovedAt: null,
      staleHours: 24,
      sentToday,
      inFlight: 0,
      cap: 20,
      lastSentAt: lastSent,
      minGapSeconds: 60,
      sendsLastMinute: 0,
      maxPerMinute: 2,
      quietEndHour: null,
      jitterMs: 0,
      winner: 'send',
    });
    if (plan.kind === 'hold') {
      item.status = 'HOLD';
      continue;
    }
    if (plan.kind !== 'send') continue;
    adapter.push(item.key);
    item.status = 'SUCCEEDED';
    sentKeys.add(item.key);
    sentToday += 1;
    lastSent = clock;
    clock = new Date(clock.getTime() + 60_000);
  }
  assert(adapter.length === 20, 'backlog flush sends only the daily cap');
  assert(new Set(adapter).size === adapter.length, 'each product is sent once');
  assert(adapter.filter((key) => key === 'k-0').length === 1, 'one adapter create for the duplicated key');
  assert(items.find((item) => item.id === 'old')?.status === 'HOLD', '48h row is held');
  assert(items.find((item) => item.id === 'dup')?.status === 'DEAD', 'duplicate key is not sent twice');
  assert(items.filter((item) => item.status === 'PENDING').length === 10, 'the rest of the backlog stays for the next day');
  const kept = publicationToReuse([
    { id: 'old-pub', updatedAt: new Date('2026-10-20T00:00:00.000Z'), createdAt: new Date('2026-10-19T00:00:00.000Z') },
    { id: 'new-pub', updatedAt: new Date('2026-10-24T00:00:00.000Z'), createdAt: new Date('2026-10-24T00:00:00.000Z') },
  ]);
  assert(kept?.id === 'new-pub', 'sync reuses the newest publication');
}

{
  // PR-3: DELETE collapses retries (no content hash); UPDATE still varies with content.
  const base = { sourceType: 'PRODUCT', sourceId, destinationId: dest, providerMessageId: 'm9' } as const;
  const del1 = buildIdempotencyKey({ ...base, action: 'DELETE', contentHash: 'aaa' });
  const del2 = buildIdempotencyKey({ ...base, action: 'DELETE', contentHash: 'bbb' });
  const del3 = buildIdempotencyKey({ ...base, action: 'DELETE' });
  assert(del1 === del2 && del2 === del3, 'DELETE key ignores content hash');
  assert(del1 === `DELETE:${dest}:m9:`, 'DELETE key shape is DELETE:dest:msg:');
  const up1 = buildIdempotencyKey({ ...base, action: 'UPDATE', contentHash: 'aaa' });
  const up2 = buildIdempotencyKey({ ...base, action: 'UPDATE', contentHash: 'bbb' });
  assert(up1 !== up2, 'UPDATE key changes with content hash');
  const c1 = buildIdempotencyKey({ ...base, action: 'CREATE' });
  const c2 = buildIdempotencyKey({ ...base, action: 'CREATE' });
  assert(c1 === c2, 'CREATE key is stable across calls');
}

{
  // PR-3: no time or randomness may leak into idempotency / dedupe key builders.
  const idemSrc = readFileSync(join(__dirname, 'delivery-idempotency.ts'), 'utf8');
  const start = idemSrc.indexOf('export function buildIdempotencyKey');
  const end = idemSrc.indexOf('export type ExistingCreateRow');
  const keyBuilder = idemSrc.slice(start, end);
  assert(!/Date\.now|new Date|Math\.random|randomUUID|randomBytes/.test(keyBuilder), 'buildIdempotencyKey has no time/random');
  const outboxSrc = readFileSync(join(__dirname, 'services', 'outbox.service.ts'), 'utf8');
  const dStart = outboxSrc.indexOf('export function buildDedupeKey');
  assert(dStart >= 0, 'buildDedupeKey exists');
  const dedupeBody = outboxSrc.slice(dStart, outboxSrc.indexOf('\n}', dStart));
  assert(!/Date\.now|new Date|Math\.random|randomUUID|randomBytes/.test(dedupeBody), 'buildDedupeKey has no time/random');
}

console.log('delivery-idempotency.spec.ts: ok');

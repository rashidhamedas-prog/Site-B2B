/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/delivery-quiet-claim.spec.ts
 * PR-5: quiet hours enforced at CREATE claim (reserveCreateSend / planCreateSend) and mirrored in
 * operator slot hints (nextCreateAvailableAt). No messenger HTTP, no DB. Ids are generated UUIDs.
 */
import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  decideDailyCap,
  decideQuietHours,
  planCreateSend,
} from '../delivery-idempotency';
import { DELIVERY_DEFERRED_REASONS } from '../omnichannel.constants';
import { nextQuietEnd } from '../../../lib/tehran-time';
import { OmnichannelService } from './omnichannel.service';
import { DEFER_CREATE_SQL, RESERVE_CREATE_COUNTS_SQL } from './reserve-create-send-sql';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Tehran is UTC+03:30 with no DST.
const NIGHT = new Date('2026-10-28T20:00:00.000Z'); // 23:30 Tehran
const DAY = new Date('2026-10-28T09:00:00.000Z'); // 12:30 Tehran
const EARLY = new Date('2026-10-28T23:00:00.000Z'); // 02:30 Tehran next day
const QUIET_END_AFTER_NIGHT = new Date('2026-10-29T04:30:00.000Z'); // 08:00 Tehran

const basePlan = {
  reapprovedAt: null,
  staleHours: 24,
  sentToday: 0,
  inFlight: 0,
  cap: 20,
  lastSentAt: null,
  minGapSeconds: 60,
  sendsLastMinute: 0,
  maxPerMinute: 2,
  jitterMs: 0,
  winner: 'send' as const,
};

// 1. Pure layer
{
  assert(DELIVERY_DEFERRED_REASONS.includes('quiet_hours'), 'quiet_hours is catalogued');

  const night = planCreateSend({
    ...basePlan, now: NIGHT, createdAt: new Date(NIGHT.getTime() - 3_600_000),
    quietStartHour: 23, quietEndHour: 8,
  });
  assert(night.kind === 'defer' && night.reason === 'quiet_hours', 'inside 23→08 defers with quiet_hours');
  assert(
    night.kind === 'defer' && night.availableAt.getTime() === QUIET_END_AFTER_NIGHT.getTime(),
    'availableAt is the next quiet end (08:00 Tehran)',
  );
  assert(
    night.kind === 'defer' && night.availableAt.getTime() === nextQuietEnd(NIGHT, 8).getTime(),
    'same semantics as nextQuietEnd',
  );

  const early = planCreateSend({
    ...basePlan, now: EARLY, createdAt: new Date(EARLY.getTime() - 3_600_000),
    quietStartHour: 23, quietEndHour: 8,
  });
  assert(
    early.kind === 'defer' && early.availableAt.getTime() === QUIET_END_AFTER_NIGHT.getTime(),
    'after midnight still inside window: same-day 08:00',
  );

  const day = planCreateSend({
    ...basePlan, now: DAY, createdAt: new Date(DAY.getTime() - 3_600_000),
    quietStartHour: 23, quietEndHour: 8,
  });
  assert(day.kind === 'send', 'outside the window is unchanged (send)');

  // Window disabled when partial / equal / omitted (back-compat call sites).
  for (const [s, e] of [[null, 8], [23, null], [null, null], [8, 8]] as const) {
    const p = planCreateSend({
      ...basePlan, now: NIGHT, createdAt: new Date(NIGHT.getTime() - 3_600_000),
      quietStartHour: s, quietEndHour: e,
    });
    assert(p.kind === 'send', `partial/empty window (${s},${e}) is disabled`);
  }
  const legacy = planCreateSend({
    ...basePlan, now: NIGHT, createdAt: new Date(NIGHT.getTime() - 3_600_000), quietEndHour: 8,
  });
  assert(legacy.kind === 'send', 'quietStartHour omitted = no quiet gate');

  // Ordering: supersede and stale HOLD win over quiet; quiet wins over cap/gap/rate.
  const sup = planCreateSend({
    ...basePlan, now: NIGHT, createdAt: new Date(NIGHT.getTime() - 3_600_000),
    quietStartHour: 23, quietEndHour: 8, winner: 'supersede',
  });
  assert(sup.kind === 'supersede', 'supersede precedes quiet');
  const stale = planCreateSend({
    ...basePlan, now: NIGHT, createdAt: new Date(NIGHT.getTime() - 48 * 3_600_000),
    quietStartHour: 23, quietEndHour: 8,
  });
  assert(stale.kind === 'hold', 'stale HOLD precedes quiet');
  const capped = planCreateSend({
    ...basePlan, now: NIGHT, createdAt: new Date(NIGHT.getTime() - 3_600_000),
    quietStartHour: 23, quietEndHour: 8, sentToday: 20,
  });
  assert(capped.kind === 'defer' && capped.reason === 'quiet_hours', 'quiet reported before daily_cap while in window');

  // Non-wrapping window.
  assert(decideQuietHours(DAY, 12, 14).allow === false, 'same-day window 12→14 blocks 12:30');
  assert(decideQuietHours(DAY, 14, 16).allow === true, 'same-day window 14→16 allows 12:30');

  // Regression: cap jitter with quietEndHour still lands after midnight + quiet end.
  const cap = decideDailyCap({ sentToday: 20, inFlight: 0, cap: 20, now: DAY, quietEndHour: 8, jitterMs: 1000 });
  assert(cap.allow === false && cap.availableAt!.getTime() === new Date('2026-10-29T04:30:01.000Z').getTime(),
    'decideDailyCap quiet-end rollover unchanged');
}

// 2. reserveCreateSend wiring
function claimHarness(destSettings: Record<string, unknown> | null, now: Date, createdAt = new Date(now.getTime() - 3_600_000)) {
  const id = randomUUID();
  const destinationId = randomUUID();
  const connectionId = randomUUID();
  const state = {
    id,
    status: 'PENDING',
    action: 'CREATE',
    supersededAt: null as Date | null,
    createdAt,
    reapprovedAt: null as Date | null,
    idempotencyKey: `CREATE:PRODUCT:${randomUUID()}:${destinationId}`,
    eventId: randomUUID(),
  };
  const stats = { claims: 0, defers: [] as unknown[][], countsParams: [] as unknown[][] };
  const svc = Object.create(OmnichannelService.prototype) as Record<string, unknown>;
  svc.deliveries = {
    findOne: async () => ({ ...state }),
    manager: {
      transaction: async (fn: (tx: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) => Promise<unknown>) => fn({
        query: async (sql: string, params?: unknown[]) => {
          if (sql.includes('pg_advisory_xact_lock')) return [];
          if (sql.includes('FOR UPDATE')) return [{ ...state }];
          if (sql.includes('"idempotencyKey" = $1::text')) return [];
          if (sql.includes('AS sent')) {
            stats.countsParams.push(params || []);
            return [{ sent: 0, inflight: 0, last_sent: null, per_minute: 0 }];
          }
          if (sql === DEFER_CREATE_SQL) {
            stats.defers.push(params || []);
            state.status = 'PENDING';
            return [{ id }];
          }
          if (sql.includes("SET status = 'PROCESSING'")) {
            stats.claims += 1;
            state.status = 'PROCESSING';
            return [{ id }];
          }
          throw new Error(`unexpected SQL in harness: ${sql.slice(0, 60)}`);
        },
      }),
    },
  };
  svc.destinations = { findOne: async () => (destSettings === null ? null : { id: destinationId, connectionId, publishSettings: destSettings }) };
  svc.connections = { findOne: async () => ({ id: connectionId, provider: 'BALE', channel: 'RETAIL', publishSettings: null }) };
  svc.loadStoredSettings = async () => ({});
  const reserve = () => (svc as unknown as {
    reserveCreateSend: (i: unknown) => Promise<{ kind: string; reason?: string; availableAt?: Date }>;
  }).reserveCreateSend({
    eventId: state.eventId, destinationId, connectionId, provider: 'BALE', channel: 'RETAIL', now,
  });
  return { state, stats, reserve };
}

const quietDest = { seeded: true, quietStartHour: 23, quietEndHour: 8 };

async function main() {
  {
    // Acceptance 1 + 4: outbox fires at 23:30 → defer, no adapter claim, row left PENDING.
    const h = claimHarness(quietDest, NIGHT);
    const r = await h.reserve();
    assert(r.kind === 'defer' && r.reason === 'quiet_hours', `defers with quiet_hours (got ${r.kind}/${r.reason})`);
    assert(r.availableAt!.getTime() === QUIET_END_AFTER_NIGHT.getTime(), 'defer availableAt = quiet end');
    assert(h.stats.claims === 0, 'zero PROCESSING claims → zero adapter calls');
    assert(h.state.status === 'PENDING', 'row is not left PROCESSING');
    assert(h.stats.defers.length === 1 && h.stats.defers[0][1] === 'quiet_hours', 'DEFER_CREATE_SQL stores quiet_hours');
    assert((h.stats.defers[0][2] as Date).getTime() === QUIET_END_AFTER_NIGHT.getTime(), 'DEFER_CREATE_SQL stores nextAttemptAt');
  }

  {
    // Outside the window: unchanged, claims and sends.
    const h = claimHarness(quietDest, DAY);
    const r = await h.reserve();
    assert(r.kind === 'send' && h.stats.claims === 1, 'daytime claim proceeds');
  }

  {
    // Acceptance 3: two destinations, same clock, different settings, independent.
    const quiet = claimHarness({ seeded: true, quietStartHour: 23, quietEndHour: 8 }, NIGHT);
    const open = claimHarness({ seeded: true, quietStartHour: 1, quietEndHour: 5 }, NIGHT);
    const none = claimHarness({ seeded: true }, NIGHT);
    assert((await quiet.reserve()).kind === 'defer', 'destination with 23→08 defers');
    assert((await open.reserve()).kind === 'send', 'destination with 01→05 sends at 23:30');
    assert((await none.reserve()).kind === 'send', 'destination without a window sends');
  }

  {
    // Missing destination/connection resolves to defaults: no window, no quiet defer.
    const h = claimHarness(null, NIGHT);
    assert((await h.reserve()).kind === 'send', 'unresolved settings do not invent a quiet window');
  }

  // 3. Slot hints (acceptance 5)
  const hintHarness = (settings: Record<string, unknown>, sentToday = 0, lastSent: Date | null = null) => {
    const svc = Object.create(OmnichannelService.prototype) as Record<string, unknown>;
    const destinationId = randomUUID();
    const connectionId = randomUUID();
    svc.destinations = { findOne: async () => ({ id: destinationId, connectionId, publishSettings: settings }) };
    svc.connections = { findOne: async () => ({ id: connectionId, provider: 'BALE', channel: 'RETAIL', publishSettings: null }) };
    svc.loadStoredSettings = async () => ({});
    svc.countCreatesTowardDailyCap = async () => sentToday;
    svc.lastSentAt = async () => lastSent;
    return (now: Date) => (svc as unknown as {
      nextCreateAvailableAt: (id: string, now: Date) => Promise<{ availableAt: Date; reason: string | null }>;
    }).nextCreateAvailableAt(destinationId, now);
  };

  {
    const slot = hintHarness(quietDest);
    const inside = await slot(NIGHT);
    assert(inside.availableAt.getTime() === QUIET_END_AFTER_NIGHT.getTime(), 'hint inside window = quiet end');
    assert(inside.reason === 'quiet_hours', 'hint reason is quiet_hours');
    const outside = await slot(DAY);
    assert(outside.availableAt.getTime() === DAY.getTime() && outside.reason === null, 'hint outside window = now');
  }

  {
    // min-gap that lands inside the window is pushed out of it (same shift as evaluateAutomationGate).
    const slot = hintHarness({ ...quietDest, autoMinGapSeconds: 600 }, 0, new Date('2026-10-28T19:55:00.000Z'));
    const hint = await slot(new Date('2026-10-28T19:56:00.000Z')); // 23:26 Tehran; gap end 23:35 also inside
    assert(hint.availableAt.getTime() === QUIET_END_AFTER_NIGHT.getTime() && hint.reason === 'quiet_hours', 'gap inside window → quiet end');
    // gap pushes a daytime slot into the window → still shifted out.
    const edge = hintHarness({ seeded: true, quietStartHour: 12, quietEndHour: 14, autoMinGapSeconds: 600 }, 0, new Date('2026-10-28T08:25:00.000Z'));
    const e = await edge(new Date('2026-10-28T08:26:00.000Z')); // 11:56 Tehran, gap end 11:55+10m = 12:05
    assert(e.reason === 'quiet_hours' && e.availableAt.getTime() === new Date('2026-10-28T10:30:00.000Z').getTime(), 'gap end entering window → quiet end 14:00 Tehran');
  }

  {
    // Cap rollover with a quiet window: next day quiet end + jitter is already outside the window.
    const slot = hintHarness(quietDest, 20);
    const hint = await slot(DAY);
    assert(hint.reason === 'daily_cap', 'daily cap keeps its reason when rollover lands outside the window');
    assert(hint.availableAt.getTime() >= new Date('2026-10-29T04:30:00.000Z').getTime(), 'cap rollover ≥ next-day quiet end');
  }

  // 4. Source guards: claim SQL casts (42P08), no new lease/attempt columns, no new env flags, worker untouched.
  {
    const svcSrc = readFileSync(join(__dirname, 'omnichannel.service.ts'), 'utf8');
    assert(/quietStartHour,\s*\n\s*quietEndHour,/.test(svcSrc), 'reserveCreateSend passes quiet start+end into planCreateSend');
    assert(RESERVE_CREATE_COUNTS_SQL.includes('$1::uuid') && RESERVE_CREATE_COUNTS_SQL.includes('::timestamptz'), 'counts SQL keeps 42P08 casts');
    assert(DEFER_CREATE_SQL.includes('$2::text'), 'defer SQL keeps $2::text');
    assert(!/attempt_started|lease_until/.test(svcSrc), 'PR-5 adds no attempt_started/lease_until');
    const workerSrc = readFileSync(join(__dirname, 'outbox-worker.service.ts'), 'utf8');
    assert(workerSrc.includes('throw new DeliveryDeferredError(gate.message, gate.availableAt, gate.reason)'), 'worker defers via DeliveryDeferredError before adapter');
  }

  console.log('delivery-quiet-claim.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

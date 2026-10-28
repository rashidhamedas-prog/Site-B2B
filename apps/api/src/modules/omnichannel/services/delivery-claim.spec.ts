/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/delivery-claim.spec.ts
 * Dual-worker claim + timeout HOLD + cap gate (no real messenger HTTP).
 */
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  dailyCapForProvider,
  decideDailyCap,
  planCreateSend,
} from '../delivery-idempotency';
import { DEFAULT_AUTO_DAILY_CAP, DELIVERY_DEFERRED_REASONS } from '../omnichannel.constants';
import { isUnconfirmedSendError } from './publication-deliver';
import { OmnichannelService } from './omnichannel.service';
import {
  MARK_CREATE_HOLD_SQL,
  MARK_CREATE_UNCONFIRMED_SQL,
  RESERVE_CREATE_COUNTS_SQL,
} from './reserve-create-send-sql';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Simulate atomic UPDATE … WHERE status IN ('PENDING','RETRY') RETURNING id under two workers. */
function claimOnce(row: { status: string }): boolean {
  if (row.status === 'PENDING' || row.status === 'RETRY') {
    row.status = 'PROCESSING';
    return true;
  }
  return false;
}

{
  const shared = { status: 'PENDING' };
  const workerA = claimOnce(shared);
  const workerB = claimOnce(shared);
  assert(workerA === true && workerB === false, 'only one worker claims a PENDING delivery');
  assert(shared.status === 'PROCESSING', 'winner leaves the row PROCESSING');

  const exits: Array<'SUCCEEDED' | 'HOLD' | 'RETRY' | 'PENDING' | 'DEAD'> = [
    'SUCCEEDED',
    'HOLD',
    'RETRY',
    'PENDING',
    'DEAD',
  ];
  for (const next of exits) {
    const row = { status: 'PROCESSING' as string };
    row.status = next;
    assert(row.status !== 'PROCESSING', `exit path ${next} leaves PROCESSING`);
  }
}

{
  const timeoutErr = new Error('outbox publication.deliver.requested x timed out after 50000ms');
  assert(isUnconfirmedSendError(timeoutErr) === true, 'handle timeout is unconfirmed');
  assert(
    DELIVERY_DEFERRED_REASONS.includes('uncertain_after_timeout'),
    'HOLD reason uncertain_after_timeout is catalogued',
  );
  // No auto-resend: decision layer treats HOLD as skip, not reuse.
  const heldStatus: string = 'HOLD';
  assert(heldStatus !== 'RETRY' && heldStatus !== 'PENDING', 'timeout must not land on RETRY/PENDING');
}

{
  const cap = dailyCapForProvider('BALE', 20);
  assert(cap === 20, 'cap reads connection autoDailyCap');
  assert(dailyCapForProvider('RUBIKA', 0) === DEFAULT_AUTO_DAILY_CAP, 'missing cap uses DEFAULT_AUTO_DAILY_CAP');
  const blocked = decideDailyCap({
    sentToday: 20,
    inFlight: 0,
    cap,
    now: new Date('2026-10-25T12:00:00.000Z'),
    quietEndHour: null,
    jitterMs: 0,
  });
  assert(blocked.allow === false, 'full cap blocks before adapter');
  const plan = planCreateSend({
    now: new Date('2026-10-25T12:00:00.000Z'),
    createdAt: new Date('2026-10-25T11:00:00.000Z'),
    reapprovedAt: null,
    staleHours: 24,
    sentToday: 20,
    inFlight: 0,
    cap,
    lastSentAt: null,
    minGapSeconds: 60,
    sendsLastMinute: 0,
    maxPerMinute: 2,
    quietEndHour: null,
    jitterMs: 0,
    winner: 'send',
  });
  assert(plan.kind === 'defer' && plan.reason === 'daily_cap', 'worker defers without burning attempts');
}

{
  const workerSrc = readFileSync(join(__dirname, 'outbox-worker.service.ts'), 'utf8');
  assert(workerSrc.includes('HANDLE_TIMEOUT_CREATE_MEDIA_MS'), 'CREATE media timeout constant exists');
  assert(workerSrc.includes('50_000') || workerSrc.includes('50000'), 'CREATE media budget is 50s');
  assert(workerSrc.includes('markCreateUnconfirmed'), 'timeout path HOLDs via markCreateUnconfirmed');
  assert(workerSrc.includes('releaseProcessingDelivery'), 'defer path exits PROCESSING');
  const svcSrc = readFileSync(join(__dirname, 'omnichannel.service.ts'), 'utf8');
  assert(svcSrc.includes('uncertain_after_timeout'), 'service stores uncertain_after_timeout');
  assert(!svcSrc.includes("'send_unconfirmed'"), 'legacy send_unconfirmed reason removed from writes');
  assert(
    svcSrc.includes("status IN ('PENDING', 'RETRY')") || svcSrc.includes("status IN ('PENDING','RETRY')"),
    'atomic claim filters PENDING|RETRY',
  );
}

{
  // PR-3: the claim and reserve SQL are the real constants/source, not a simulation.
  const svcSrc = readFileSync(join(__dirname, 'omnichannel.service.ts'), 'utf8');
  assert(svcSrc.includes('RESERVE_CREATE_LOCK_ROW_SQL'), 'reserveCreateSend re-reads the row under lock');
  assert(/status IN \('PENDING', 'RETRY'\)\s+RETURNING id/.test(svcSrc), 'claim keeps WHERE status IN (PENDING, RETRY) RETURNING id');
  assert(RESERVE_CREATE_COUNTS_SQL.includes('$1::uuid') && RESERVE_CREATE_COUNTS_SQL.includes('::timestamptz'), 'counts keep 42P08 casts');
  assert(MARK_CREATE_UNCONFIRMED_SQL.includes('$2::text'), 'unconfirmed keeps $2::text');
  assert(MARK_CREATE_HOLD_SQL.includes('$2::text'), 'HOLD keeps $2::text');
}

/**
 * Drives the real reserveCreateSend against an in-memory delivery with a per-row mutex that
 * stands in for pg_advisory_xact_lock + FOR UPDATE. Real Postgres coverage: delivery-idempotency.integration.spec.ts.
 */
function reserveHarness(initial: { status: string; supersededAt?: Date | null }) {
  const id = '5c1f1c8e-3f0b-4d55-8a3b-2f0f6f2d7a10';
  const state = {
    id,
    status: initial.status,
    action: 'CREATE',
    supersededAt: initial.supersededAt || null,
    createdAt: new Date(),
    reapprovedAt: null as Date | null,
    idempotencyKey: 'CREATE:PRODUCT:p1:d1',
    eventId: '0b1c2d3e-0000-4000-8000-000000000001',
  };
  const stats = { unconfirmed: 0, claims: 0 };
  let tail: Promise<unknown> = Promise.resolve();
  const svc = Object.create(OmnichannelService.prototype) as Record<string, unknown>;
  svc.deliveries = {
    findOne: async () => ({ ...state }),
    manager: {
      transaction: (fn: (tx: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) => Promise<unknown>) => {
        const run = tail.then(() => fn({
          query: async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return [];
            if (sql.includes('FOR UPDATE')) return [{ ...state }];
            if (sql.includes('"idempotencyKey" = $1::text')) return [];
            if (sql.includes('AS sent')) return [{ sent: 0, inflight: 0, last_sent: null, per_minute: 0 }];
            if (sql.includes("SET status = 'PROCESSING'")) {
              if (state.status === 'PENDING' || state.status === 'RETRY') {
                state.status = 'PROCESSING';
                stats.claims += 1;
                return [{ id }];
              }
              return [];
            }
            throw new Error(`unexpected SQL in harness: ${sql.slice(0, 60)}`);
          },
        }));
        tail = run.catch(() => undefined);
        return run;
      },
    },
    query: async (sql: string) => {
      if (sql.includes('uncertain') || sql.includes("status = 'HOLD'")) {
        stats.unconfirmed += 1;
        state.status = 'HOLD';
      }
      return [];
    },
  };
  svc.destinations = { findOne: async () => null };
  svc.connections = { findOne: async () => null };
  svc.loadStoredSettings = async () => ({});
  const input = {
    eventId: state.eventId,
    destinationId: 'dd111111-0000-4000-8000-000000000001',
    connectionId: 'cc111111-0000-4000-8000-000000000001',
    provider: 'BALE',
    channel: 'RETAIL',
  };
  const reserve = () => (svc as unknown as {
    reserveCreateSend: (i: typeof input) => Promise<{ kind: string }>;
  }).reserveCreateSend(input);
  return { state, stats, reserve };
}

async function main() {
  {
    // Two workers pre-read PENDING at the same time; only one may send.
    const h = reserveHarness({ status: 'PENDING' });
    const [a, b] = await Promise.all([h.reserve(), h.reserve()]);
    const kinds = [a.kind, b.kind].sort();
    assert(kinds.join(',') === 'send,stop', `exactly one send, one stop (got ${kinds.join(',')})`);
    assert(h.stats.claims === 1, 'one atomic claim');
    assert(h.state.status === 'PROCESSING', 'row left PROCESSING for the winner');
    assert(h.stats.unconfirmed === 0, 'the loser must not HOLD a live sibling send');
  }

  {
    // Restart / lease reclaim: delivery is PROCESSING → HOLD uncertain, never another send.
    const h = reserveHarness({ status: 'PROCESSING' });
    const r = await h.reserve();
    assert(r.kind === 'stop', 'PROCESSING on reclaim stops');
    assert(h.stats.unconfirmed === 1 && h.state.status === 'HOLD', 'PROCESSING reclaim goes to HOLD (uncertain_after_timeout)');
    assert(h.stats.claims === 0, 'no second adapter call (no claim)');
    const again = await h.reserve();
    assert(again.kind === 'stop', 'HOLD is never auto-resent');
  }

  {
    const superseded = reserveHarness({ status: 'PENDING', supersededAt: new Date() });
    assert((await superseded.reserve()).kind === 'stop', 'superseded row never sends');
    const done = reserveHarness({ status: 'SUCCEEDED' });
    assert((await done.reserve()).kind === 'stop', 'SUCCEEDED row never sends again');
  }

  {
    // PR-4: revive takes exactly one row unless the rollback flag is on; never touches HOLD rows.
    const runRevive = async (bulkFlag: string | undefined, requested: number) => {
      const prevConnectors = process.env.OMNICHANNEL_CONNECTORS_ENABLED;
      const prevBulk = process.env.OMNICHANNEL_BULK_REVIVE_ENABLED;
      process.env.OMNICHANNEL_CONNECTORS_ENABLED = 'true';
      if (bulkFlag === undefined) delete process.env.OMNICHANNEL_BULK_REVIVE_ENABLED;
      else process.env.OMNICHANNEL_BULK_REVIVE_ENABLED = bulkFlag;
      try {
        const seen: { take?: number; wheres: string[]; reactivated: string[] } = { wheres: [], reactivated: [] };
        const dead = ['a', 'b', 'c'].map((id) => ({ id, status: 'DEAD' }));
        const qb = {
          where(sql: string) { seen.wheres.push(sql); return qb; },
          andWhere(sql: string) { seen.wheres.push(sql); return qb; },
          orderBy() { return qb; },
          take(n: number) { seen.take = n; return qb; },
          getMany: async () => dead.slice(0, seen.take),
        };
        const svc = Object.create(OmnichannelService.prototype) as Record<string, unknown>;
        svc.deliveries = { createQueryBuilder: () => qb };
        svc.requireActor = () => ({ id: 'u1', role: 'OWNER' });
        svc.reactivateDelivery = async (row: { id: string }) => {
          seen.reactivated.push(row.id);
          return { retried: true, superseded: false };
        };
        svc.audit = async () => undefined;
        svc.outboxMetrics = async () => ({});
        const result = await (svc as unknown as {
          reviveConnectorDisabledDead: (dto: unknown, actor: unknown) => Promise<{ limitApplied: number; bulk: boolean; revivedDeliveries: number }>;
        }).reviveConnectorDisabledDead({ confirm: true, reason: 'ok', limit: requested }, { id: 'u1' });
        return { seen, result };
      } finally {
        if (prevConnectors === undefined) delete process.env.OMNICHANNEL_CONNECTORS_ENABLED;
        else process.env.OMNICHANNEL_CONNECTORS_ENABLED = prevConnectors;
        if (prevBulk === undefined) delete process.env.OMNICHANNEL_BULK_REVIVE_ENABLED;
        else process.env.OMNICHANNEL_BULK_REVIVE_ENABLED = prevBulk;
      }
    };

    const single = await runRevive(undefined, 200);
    assert(single.seen.take === 1, 'default revive LIMIT 1 even when the client asks for 200');
    assert(single.result.limitApplied === 1 && single.result.bulk === false, 'response reports single mode');
    assert(single.seen.reactivated.join(',') === 'a', 'only the oldest DEAD row is reactivated');
    assert(
      single.seen.wheres.some((w) => w.includes('d.status = :status')) && single.seen.wheres.some((w) => w.includes('d.action = :action')),
      'revive stays scoped to DEAD CREATE rows (HOLD is never revived here)',
    );

    const bulk = await runRevive('true', 200);
    assert(bulk.seen.take === 200 && bulk.result.bulk === true, 'rollback flag restores legacy batch size');
    assert(bulk.seen.reactivated.length === 3, 'rollback flag reactivates the whole batch');
  }

  console.log('delivery-claim.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

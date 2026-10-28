/**
 * PR-3: reactivateDelivery must never surface a raw Postgres 23505 to the admin.
 * npx ts-node --transpile-only src/modules/omnichannel/services/delivery-reactivate-conflict.spec.ts
 */
import 'reflect-metadata';
import { OmnichannelService, isUniqueViolation } from './omnichannel.service';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

type Row = Record<string, unknown>;

function build(queryImpl: () => Promise<unknown>, stored: Row) {
  const audits: Array<{ action: string; payload: Record<string, unknown> }> = [];
  let saved: Row | null = null;
  const svc = Object.create(OmnichannelService.prototype) as Record<string, unknown>;
  svc.deliveries = {
    findOne: async () => ({ ...stored }),
    query: queryImpl,
    save: async (row: Row) => {
      saved = { ...row };
      return row;
    },
  };
  svc.nextCreateAvailableAt = async () => ({ availableAt: new Date('2026-10-28T10:00:00.000Z'), reason: null });
  svc.audit = async (_who: unknown, action: string, _t: string, _id: string, _c: unknown, _r: unknown, payload: Record<string, unknown>) => {
    audits.push({ action, payload });
  };
  return { svc, audits, getSaved: () => saved };
}

async function main() {
  assert(isUniqueViolation({ code: '23505' }) === true, 'raw pg error is a unique violation');
  assert(isUniqueViolation({ driverError: { code: '23505' } }) === true, 'TypeORM wrapped error is a unique violation');
  assert(isUniqueViolation({ code: '42P08' }) === false, 'other codes are not');
  assert(isUniqueViolation(new Error('x')) === false, 'plain errors are not');

  const id = '9d7a4c1e-6f0b-4b6a-9a52-0a7f9c3b2e11';
  const stored: Row = {
    id,
    status: 'HOLD',
    action: 'CREATE',
    idempotencyKey: 'CREATE:PRODUCT:p1:d1',
    supersededAt: null,
    publicationId: 'pub',
    destinationId: 'dst',
    eventId: null,
  };

  // 23505 from the partial UNIQUE → superseded result + audit, no throw.
  {
    const { svc, audits, getSaved } = build(async () => {
      const err = new Error('duplicate key value violates unique constraint "UQ_omnichannel_deliveries_active_create"') as Error & { code: string };
      err.code = '23505';
      throw err;
    }, stored);
    const result = await (svc as unknown as {
      reactivateDelivery: (r: Row, w: unknown, reason: string, action: string) => Promise<{ retried: boolean; superseded: boolean; delivery: Row }>;
    }).reactivateDelivery({ ...stored }, { id: 'admin' }, 'manual', 'reapprove');
    assert(result.retried === false && result.superseded === true, 'conflict returns superseded, not a throw');
    assert(result.delivery.status === 'DEAD' && result.delivery.lastError === 'superseded_duplicate', 'loser row is DEAD superseded_duplicate');
    assert(result.delivery.supersededAt instanceof Date, 'loser leaves the active index');
    assert(getSaved()?.id === id, 'row persisted');
    assert(audits.length === 1 && audits[0].action === 'reapprove' && audits[0].payload.superseded === true, 'audit written');
    assert(audits[0].payload.conflict === 'active_slot_taken', 'audit explains the conflict');
  }

  // Non-23505 errors still propagate.
  {
    const { svc } = build(async () => {
      const err = new Error('boom') as Error & { code: string };
      err.code = '42P08';
      throw err;
    }, stored);
    let thrown = false;
    try {
      await (svc as unknown as { reactivateDelivery: (...a: unknown[]) => Promise<unknown> })
        .reactivateDelivery({ ...stored }, { id: 'admin' }, 'manual', 'retry');
    } catch {
      thrown = true;
    }
    assert(thrown, 'unrelated DB errors are not swallowed');
  }

  console.log('delivery-reactivate-conflict.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

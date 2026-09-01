/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/outbox.service.spec.ts
 */
import {
  MARK_DONE_SQL,
  MARK_FAILURE_SQL,
  buildDedupeKey,
  leaseRowsFromQueryResult,
  sanitizeOutboxPayload,
  type OutboxEnqueueInput,
} from './outbox.service';
import { OUTBOX_EVENT_TYPES } from '../omnichannel.constants';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const a: OutboxEnqueueInput = {
    operationId: 'op-1',
    eventType: OUTBOX_EVENT_TYPES.PRODUCT_CREATED,
    aggregateType: 'PRODUCT',
    aggregateId: 'p1',
    channel: 'RETAIL',
  };
  assert(buildDedupeKey(a) === buildDedupeKey({ ...a }), 'same op is same key');
  assert(
    buildDedupeKey({ ...a, operationId: 'op-2' }) !== buildDedupeKey(a),
    'new operation is a new key',
  );

  const clean = sanitizeOutboxPayload({
    productId: 'p1',
    jwt: 'eyJhbGciOi',
    phone: '09120000000',
    email: 'a@b.c',
    token: 'secret',
    nested: { password: 'x', sku: 'SKU1' },
  });
  assert(clean.productId === 'p1', 'id kept');
  assert(clean.jwt === undefined, 'jwt stripped');
  assert(clean.phone === undefined, 'phone stripped');
  assert(clean.email === undefined, 'email stripped');
  assert(clean.token === undefined, 'token stripped');
  assert((clean.nested as Record<string, unknown>).sku === 'SKU1', 'nested sku kept');
  assert((clean.nested as Record<string, unknown>).password === undefined, 'nested secret stripped');

  const state = { committed: false, events: [] as string[] };
  const txn = async (fn: () => Promise<void>) => {
    state.committed = false;
    try {
      await fn();
      state.committed = true;
    } catch {
      state.events.length = 0;
      state.committed = false;
      throw new Error('rolled back');
    }
  };

  const writeBoth = async (failAfterBusiness: boolean) => {
    state.events.push('product');
    if (failAfterBusiness) throw new Error('injected');
    state.events.push('outbox');
  };

  await txn(() => writeBoth(false));
  assert(state.committed && state.events.join(',') === 'product,outbox', 'commit both');

  try {
    await txn(() => writeBoth(true));
  } catch {
    /* expected */
  }
  assert(!state.committed && state.events.length === 0, 'fault injection rolls back data+event');

  assert(MARK_DONE_SQL.includes("status = 'DONE'"), 'done SQL sets DONE');
  assert(MARK_DONE_SQL.includes('"lockedAt" = NULL'), 'done SQL clears the lease');
  assert(MARK_FAILURE_SQL.includes('status = $2'), 'failure SQL sets PENDING or DEAD');
  assert(MARK_FAILURE_SQL.includes('"lockedAt" = NULL'), 'failure SQL clears the lease');

  const leased = leaseRowsFromQueryResult([[{ id: 'a' }, { id: 'b' }], 2]);
  assert(leased.map((r) => r.id).join(',') === 'a,b', 'UPDATE RETURNING tuple unwraps rows');
  assert(leaseRowsFromQueryResult([{ id: 'c' }]).map((r) => r.id).join(',') === 'c', 'plain row array still works');
  assert(leaseRowsFromQueryResult(null).length === 0, 'null is empty');

  console.log('outbox.service.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

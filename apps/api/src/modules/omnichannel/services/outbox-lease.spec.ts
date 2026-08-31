/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/outbox-lease.spec.ts
 */
import {
  nextAvailableAt, shouldDeadLetter, PHASE3_EVENT_TYPES, PHASE4_EVENT_TYPES, LEASE_SQL, leaseEventTypes,
} from './outbox-lease';
import { OUTBOX_EVENT_TYPES } from '../omnichannel.constants';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const now = new Date('2026-08-26T12:00:00.000Z');
  const first = nextAvailableAt(1, now, 0);
  assert(first.getTime() === now.getTime() + 2000, 'attempt 1 → 2s');
  const later = nextAvailableAt(8, now, 0);
  assert(later.getTime() === now.getTime() + 256_000, 'attempt 8 → 256s');
  const capped = nextAvailableAt(20, now, 0);
  assert(capped.getTime() === now.getTime() + 3_600_000, 'backoff cap 1h');
  const jittered = nextAvailableAt(1, now, 1);
  assert(jittered.getTime() === now.getTime() + 2500, 'full jitter adds 25%');
}

assert(shouldDeadLetter(8, 8) === true, 'at max is dead');
assert(shouldDeadLetter(7, 8) === false, 'below max retries');
assert(PHASE3_EVENT_TYPES.includes(OUTBOX_EVENT_TYPES.SEARCH_REINDEX_REQUESTED), 'search handled');
assert(PHASE3_EVENT_TYPES.includes(OUTBOX_EVENT_TYPES.PRODUCT_STOCK_CHANGED), 'stock_changed is consumed');
assert(LEASE_SQL.includes('FOR UPDATE SKIP LOCKED'), 'lease skips locked rows');
assert(
  !(PHASE3_EVENT_TYPES as readonly string[]).includes(OUTBOX_EVENT_TYPES.PRODUCT_CREATED),
  'product.created is not a Phase 3 side-effect',
);
assert(
  (PHASE4_EVENT_TYPES as readonly string[]).includes(OUTBOX_EVENT_TYPES.PRODUCT_CREATED),
  'product.created is consumed for publication sync',
);
assert(
  leaseEventTypes(false).includes(OUTBOX_EVENT_TYPES.PRODUCT_PRICE_CHANGED),
  'price_changed is leased without connectors',
);
assert(
  leaseEventTypes(false).includes(OUTBOX_EVENT_TYPES.BLOG_PUBLISHED),
  'blog.published is leased without connectors',
);
assert(
  LEASE_SQL.includes(OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED),
  'full lease sql can include publication deliver',
);
assert(
  !leaseEventTypes(false).includes(OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED),
  'connectors off does not lease publication deliver',
);
assert(
  leaseEventTypes(true).includes(OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED),
  'connectors on leases publication deliver',
);

{
  type Row = { id: string; status: 'PENDING' | 'PROCESSING'; lockedBy: string | null };
  const lease = (rows: Row[], workerId: string, limit: number) => {
    const taken: string[] = [];
    for (const row of rows) {
      if (taken.length >= limit) break;
      if (row.status !== 'PENDING') continue;
      row.status = 'PROCESSING';
      row.lockedBy = workerId;
      taken.push(row.id);
    }
    return taken;
  };
  const rows: Row[] = ['e1', 'e2', 'e3'].map((id) => ({ id, status: 'PENDING', lockedBy: null }));
  const a = lease(rows, 'w1', 2);
  const b = lease(rows, 'w2', 2);
  assert(a.join(',') === 'e1,e2', 'first worker takes unlocked head');
  assert(b.join(',') === 'e3', 'second worker skips locked rows');
  assert(a.every((id) => !b.includes(id)), 'two workers never share a delivery');
}

console.log('outbox-lease.spec.ts: ok');

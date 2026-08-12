import { IntegrationHealthTracker } from './integration-health';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const t = new IntegrationHealthTracker();
let snap = t.snapshot();
assert(snap.lastSuccessAt === null && snap.lastErrorAt === null, 'starts empty');
assert(snap.successCount === 0 && snap.errorCount === 0, 'zero counts');

t.recordSuccess({ op: 'probe' });
snap = t.snapshot();
assert(typeof snap.lastSuccessAt === 'string', 'success timestamp');
assert(snap.successCount === 1, 'success count');
assert(snap.lastMeta?.op === 'probe', 'meta retained');

t.recordError('boom', { code: 500 });
snap = t.snapshot();
assert(snap.lastError === 'boom', 'error message');
assert(snap.errorCount === 1, 'error count');
assert(typeof snap.lastErrorAt === 'string', 'error timestamp');

console.log('integration-health.spec: OK');

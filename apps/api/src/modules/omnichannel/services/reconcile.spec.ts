/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/reconcile.spec.ts
 */
import { applyReconcileIntents, reconcilePublicationIntents } from './reconcile';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const visible = [
  { id: 'p1', channel: 'RETAIL' as const, updatedAt: '2026-08-29T10:00:00.000Z' },
  { id: 'p2', channel: 'WHOLESALE' as const, updatedAt: '2026-08-29T10:00:00.000Z' },
];

{
  const first = reconcilePublicationIntents(visible, []);
  assert(first.length === 2 && first.every((i) => i.action === 'create'), 'missing pubs create');
  const after = applyReconcileIntents(visible, []);
  const second = reconcilePublicationIntents(visible, after);
  assert(second.length === 0, 'replay creates no extra intents');
}

{
  const existing = [
    { sourceId: 'p1', channel: 'RETAIL', status: 'PUBLISHED', sourceUpdatedAt: '2026-08-29T10:00:00.000Z' },
    { sourceId: 'gone', channel: 'RETAIL', status: 'PUBLISHED', sourceUpdatedAt: '2026-08-29T09:00:00.000Z' },
  ];
  const intents = reconcilePublicationIntents(visible, existing);
  assert(intents.some((i) => i.action === 'withdraw' && i.sourceId === 'gone'), 'withdraw hidden');
  assert(!intents.some((i) => i.sourceId === 'p1' && i.action === 'create'), 'fresh published skipped');
  const after = applyReconcileIntents(visible, existing);
  assert(reconcilePublicationIntents(visible, after).length === 0, 'replay after withdraw is empty');
}

console.log('reconcile.spec.ts: ok');

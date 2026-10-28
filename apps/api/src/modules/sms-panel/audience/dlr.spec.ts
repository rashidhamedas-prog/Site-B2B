import * as assert from 'node:assert/strict';
import { packDeliveryPath } from '../provider/smsir.provider';
import {
  backoffDelayMs,
  classifyDlr,
  csvPhone,
  mapProviderDeliveryState,
  selectDlrCandidates,
  summarizeSmsReports,
} from './dlr';

assert.equal(mapProviderDeliveryState('DeliveredToRecipient'), 'DELIVERED');
assert.equal(mapProviderDeliveryState('undelivered'), 'UNDELIVERED');
assert.equal(mapProviderDeliveryState('failed'), 'UNDELIVERED');
assert.equal(mapProviderDeliveryState(''), 'UNKNOWN');

const now = new Date('2026-10-28T12:00:00+03:30');
const old = new Date(now.getTime() - 3 * 60 * 60 * 1000);
const recentCheck = new Date(now.getTime() - 60 * 1000);
const newest = Array.from({ length: 100 }, (_, i) => ({
  id: `new-${i}`,
  createdAt: new Date(now.getTime() - i * 1000),
  dlrCheckedAt: recentCheck,
  dlrAttempts: 1,
}));
const older = {
  id: 'old-1',
  createdAt: old,
  dlrCheckedAt: null,
  dlrAttempts: 0,
};
const picked = selectDlrCandidates([...newest, older], now, 10);
assert.equal(picked[0].id, 'old-1');
assert.equal(picked.some((row) => row.id.startsWith('new-')), false);

assert.equal(backoffDelayMs(1), 5 * 60 * 1000);
assert.equal(backoffDelayMs(2), 15 * 60 * 1000);
assert.equal(backoffDelayMs(3), 60 * 60 * 1000);
assert.equal(backoffDelayMs(4), 6 * 60 * 60 * 1000);

const created = new Date(now.getTime() - 73 * 60 * 60 * 1000);
assert.equal(classifyDlr({ createdAt: created, now, providerState: 'delivered' }), 'expire');
assert.equal(
  classifyDlr({ createdAt: now, now, providerError: true, providerState: 'failed' }),
  'unchanged',
);
assert.equal(classifyDlr({ createdAt: now, now, providerState: 'delivered' }), 'delivered');

const beforeMidnight = new Date('2026-10-27T23:59:00+03:30');
const afterMidnight = new Date('2026-10-28T00:10:00+03:30');
const summary = summarizeSmsReports(
  [
    { createdAt: beforeMidnight, status: 'SENT', source: 'WHOLESALE' },
    { createdAt: afterMidnight, status: 'SENT', source: 'WHOLESALE' },
    { createdAt: afterMidnight, status: 'DELIVERED', source: 'RETAIL' },
    { createdAt: afterMidnight, status: 'DELIVERED', source: 'SALES_PARTNER' },
  ],
  new Date('2026-10-28T10:00:00+03:30'),
);
assert.equal(summary.sentToday, 1);
assert.equal(summary.deliveredToday, 2);
assert.equal(summary.bySource.WHOLESALE.sent, 1);
assert.equal(summary.bySource.RETAIL.delivered, 1);
assert.notEqual(summary.sentToday, summary.deliveredToday);

assert.equal(csvPhone('09121234567', 'SMS_OPERATOR'), '0912***4567');
assert.equal(csvPhone('09121234567', 'ADMIN'), '09121234567');
assert.equal(packDeliveryPath('pack-9'), '/send/pack/pack-9');

console.log('dlr.spec.ts: ok');

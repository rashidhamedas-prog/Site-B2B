/**
 * Local: node path/to/ts-node/dist/bin.js --transpile-only src/modules/omnichannel/unanswered-alert-policy.spec.ts
 */
import {
  DEFAULT_UNANSWERED_THRESHOLD_SEC,
  evaluateUnansweredAlerts,
  isUnansweredConversation,
  truncateBodyPreview,
  unansweredOwnerNotifyText,
  unansweredThresholdSec,
  type UnansweredConversationRow,
} from './unanswered-alert-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const t0 = new Date('2026-10-29T12:00:00.000Z');

function row(partial: Partial<UnansweredConversationRow> & Pick<UnansweredConversationRow, 'conversationId'>): UnansweredConversationRow {
  return {
    destinationId: 'dest-1',
    provider: 'BALE',
    status: 'open',
    lastCustomerMessageAt: t0,
    lastStaffReplyAt: null,
    ...partial,
  };
}

assert(unansweredThresholdSec({}) === DEFAULT_UNANSWERED_THRESHOLD_SEC, 'default threshold 60');
assert(unansweredThresholdSec({ OMNICHANNEL_UNANSWERED_THRESHOLD_SEC: '90' }) === 90, 'env threshold');
assert(unansweredThresholdSec({ OMNICHANNEL_UNANSWERED_THRESHOLD_SEC: '0' }) === DEFAULT_UNANSWERED_THRESHOLD_SEC, 'invalid env');

assert(truncateBodyPreview('  hello\nworld  ') === 'helloworld', 'preview strips controls');
assert(truncateBodyPreview('x'.repeat(250)).length === 200, 'preview max 200');

const at61 = new Date(t0.getTime() + 61_000);
assert(isUnansweredConversation(row({ conversationId: 'c1' }), at61, 60) === true, '61s unanswered');
assert(
  isUnansweredConversation(
    row({ conversationId: 'c2', lastStaffReplyAt: new Date(t0.getTime() + 30_000) }),
    at61,
    60,
  ) === false,
  'reply within window → no alert',
);
assert(
  isUnansweredConversation(row({ conversationId: 'c3' }), new Date(t0.getTime() + 30_000), 60) === false,
  'within threshold → no alert',
);

const decisions = evaluateUnansweredAlerts(
  at61,
  [
    row({ conversationId: 'raise-me' }),
    row({ conversationId: 'answered', lastStaffReplyAt: new Date(t0.getTime() + 30_000) }),
    row({ conversationId: 'dup' }),
  ],
  [{ conversationId: 'dup', status: 'open' }],
  60,
);
assert(decisions.filter((d) => d.action === 'raise').length === 1, 'one raise');
assert(decisions.find((d) => d.conversationId === 'raise-me')?.action === 'raise', 'raise-me');
assert(decisions.find((d) => d.conversationId === 'answered')?.action === 'skip', 'answered skip');
assert(
  (decisions.find((d) => d.conversationId === 'dup') as { reason?: string })?.reason === 'open_alert_exists',
  'idempotent open alert',
);

const secondScan = evaluateUnansweredAlerts(
  at61,
  [row({ conversationId: 'raise-me' })],
  [{ conversationId: 'raise-me', status: 'open' }],
  60,
);
assert(secondScan[0]?.action === 'skip', 'second scan no duplicate');

const text = unansweredOwnerNotifyText({ destinationLabel: 'کانال عمده بله', provider: 'BALE', ageSec: 90 });
assert(/بی‌پاسخ/.test(text), 'persian unanswered copy');
assert(/کانال عمده بله/.test(text), 'destination label');
assert(!/4858359991|invent|canary/i.test(text), 'no invented ids');

console.log('unanswered-alert-policy.spec.ts: ok');

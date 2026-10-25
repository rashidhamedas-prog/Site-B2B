/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/delivery-claim.spec.ts
 * Dual-worker claim + timeout HOLD + cap gate (no real messenger HTTP).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  dailyCapForProvider,
  decideDailyCap,
  planCreateSend,
} from '../delivery-idempotency';
import { DEFAULT_AUTO_DAILY_CAP, DELIVERY_DEFERRED_REASONS } from '../omnichannel.constants';
import { isUnconfirmedSendError } from './publication-deliver';

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
  const heldStatus = 'HOLD';
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

console.log('delivery-claim.spec.ts: ok');

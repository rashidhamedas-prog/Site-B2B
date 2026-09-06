/**
 * npx ts-node --transpile-only src/modules/omnichannel/publication-automation.spec.ts
 */
import {
  evaluateAutomationGate,
  inQuietHours,
  nextQuietEnd,
  resolveRemoteIntent,
  selectAutomationDestinations,
  tehranDayStart,
  tehranHour,
  type AutomationGateInput,
  type RemoteIntentInput,
} from './publication-automation';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const chosen = ['product.created', 'product.price_changed', 'product.withdrawn'];

function gateInput(over: Partial<AutomationGateInput> = {}): AutomationGateInput {
  return {
    mode: 'LIVE',
    eventType: 'product.created',
    chosenEvents: chosen,
    connectorsEnabled: true,
    autoPublishFlag: true,
    sentToday: 0,
    dailyCap: 20,
    lastScheduledAt: null,
    minGapSeconds: 90,
    quietStartHour: null,
    quietEndHour: null,
    now: new Date('2026-09-06T08:00:00.000Z'), // 11:30 Tehran
    ...over,
  };
}

function intentInput(over: Partial<RemoteIntentInput> = {}): RemoteIntentInput {
  return {
    eventType: 'product.price_changed',
    localAction: 'refresh',
    previousStatus: 'PUBLISHED',
    publishable: true,
    available: true,
    hasRemoteMessage: true,
    oosPolicy: 'UPDATE',
    oosChosen: false,
    withdrawAction: 'DELETE',
    chosenEvents: chosen,
    ...over,
  };
}

function main() {
  // Tehran clock helpers (UTC+3:30, no DST)
  assert(tehranHour(new Date('2026-09-06T20:45:00.000Z')) === 0, '20:45Z is 00:15 Tehran');
  assert(tehranHour(new Date('2026-09-06T08:00:00.000Z')) === 11, '08:00Z is 11:30 Tehran');
  assert(tehranDayStart(new Date('2026-09-06T08:00:00.000Z')).toISOString() === '2026-09-05T20:30:00.000Z', 'Tehran day start');
  assert(inQuietHours(2, 23, 8) && inQuietHours(23, 23, 8) && !inQuietHours(8, 23, 8) && !inQuietHours(12, 23, 8), 'wrapping window');
  assert(inQuietHours(14, 13, 16) && !inQuietHours(16, 13, 16), 'same-day window end exclusive');
  assert(!inQuietHours(5, 8, 8) && !inQuietHours(5, null, 8), 'no window when equal or missing');
  assert(nextQuietEnd(new Date('2026-09-06T20:45:00.000Z'), 8).toISOString() === '2026-09-07T04:30:00.000Z', 'quiet end next morning');

  // gate: modes and flags
  assert(evaluateAutomationGate(gateInput({ mode: 'OFF' })).allow === false, 'OFF never allows');
  const flagsOff = evaluateAutomationGate(gateInput({ connectorsEnabled: false }));
  assert(flagsOff.allow === false && flagsOff.reason === 'flags_off', 'env flags gate');
  const notChosen = evaluateAutomationGate(gateInput({ eventType: 'product.media_changed' }));
  assert(notChosen.allow === false && notChosen.reason === 'event_not_chosen', 'unchosen event blocked');
  assert(evaluateAutomationGate(gateInput({ eventType: 'product.media_changed', createTrigger: true })).allow === true, 'createTrigger bypasses chosen check');
  const capped = evaluateAutomationGate(gateInput({ sentToday: 20 }));
  assert(capped.allow === false && capped.reason === 'daily_cap', 'daily cap');

  // gate: immediate, min-gap, quiet hours
  const now = new Date('2026-09-06T08:00:00.000Z');
  const immediate = evaluateAutomationGate(gateInput({ now }));
  assert(immediate.allow && !immediate.deferred && immediate.sendAt.getTime() === now.getTime(), 'first post goes now');
  const spaced = evaluateAutomationGate(gateInput({ now, lastScheduledAt: new Date(now.getTime() - 30_000) }));
  assert(spaced.allow && spaced.deferred && spaced.sendAt.getTime() === now.getTime() + 60_000, 'min gap after last send');
  const chained = evaluateAutomationGate(gateInput({ now, lastScheduledAt: new Date(now.getTime() + 120_000) }));
  assert(chained.allow && chained.sendAt.getTime() === now.getTime() + 210_000, 'gap chains after a future scheduled post');
  const oldLast = evaluateAutomationGate(gateInput({ now, lastScheduledAt: new Date(now.getTime() - 600_000) }));
  assert(oldLast.allow && !oldLast.deferred, 'old last send does not defer');
  const night = new Date('2026-09-06T20:45:00.000Z'); // 00:15 Tehran
  const quiet = evaluateAutomationGate(gateInput({ now: night, quietStartHour: 23, quietEndHour: 8 }));
  assert(quiet.allow && quiet.deferred && quiet.sendAt.toISOString() === '2026-09-07T04:30:00.000Z', 'quiet hours defer to 08:00 Tehran');
  const daytime = evaluateAutomationGate(gateInput({ now, quietStartHour: 23, quietEndHour: 8 }));
  assert(daytime.allow && !daytime.deferred, 'outside quiet window sends now');

  // destination selection
  const conns = [
    { id: 'c1', provider: 'TELEGRAM', channel: 'RETAIL', status: 'ACTIVE' },
    { id: 'c2', provider: 'TELEGRAM', channel: 'WHOLESALE', status: 'ACTIVE' },
    { id: 'c3', provider: 'TELEGRAM', channel: 'RETAIL', status: 'DISABLED' },
  ];
  const verified = { verified: { checkedAt: new Date().toISOString(), ok: true, chatType: 'channel', canPost: true } };
  const dests = [
    { id: 'canary', connectionId: 'c1', enabled: true, settings: { isCanary: true } },
    { id: 'live', connectionId: 'c1', enabled: true, settings: verified },
    { id: 'unverified', connectionId: 'c1', enabled: true, settings: {} },
    { id: 'noPost', connectionId: 'c1', enabled: true, settings: { verified: { ...verified.verified, canPost: false } } },
    { id: 'off', connectionId: 'c1', enabled: false, settings: verified },
    { id: 'disabledConn', connectionId: 'c3', enabled: true, settings: verified },
    { id: 'wholesale', connectionId: 'c2', enabled: true, settings: verified },
  ];
  const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id).sort().join(',');
  assert(ids(selectAutomationDestinations(dests, conns, 'RETAIL', 'OFF')) === '', 'OFF selects none');
  assert(ids(selectAutomationDestinations(dests, conns, 'RETAIL', 'CANARY')) === 'canary', 'CANARY selects the canary only');
  assert(ids(selectAutomationDestinations(dests, conns, 'RETAIL', 'LIVE')) === 'canary,live', 'LIVE adds verified can-post destinations only');
  assert(ids(selectAutomationDestinations(dests, conns, 'WHOLESALE', 'LIVE')) === 'wholesale', 'channel isolation');

  // remote intent: chosen catalog events
  const create = resolveRemoteIntent(intentInput({ eventType: 'product.created', localAction: 'create', previousStatus: null, hasRemoteMessage: false }));
  assert(create.action === 'CREATE', 'new product → CREATE');
  const edit = resolveRemoteIntent(intentInput({ eventType: 'product.price_changed' }));
  assert(edit.action === 'UPDATE' && edit.notice === false, 'price change with live post → UPDATE');
  const unchosen = resolveRemoteIntent(intentInput({ eventType: 'product.media_changed' }));
  assert(unchosen.action === 'none' && unchosen.reason === 'event_not_chosen', 'unchosen event does nothing');
  const unchosenNoPost = resolveRemoteIntent(intentInput({ eventType: 'product.media_changed', hasRemoteMessage: false }));
  assert(unchosenNoPost.action === 'none', 'unchosen event never creates');

  // remote intent: withdraw / hidden product
  const withdrawn = resolveRemoteIntent(intentInput({ eventType: 'product.withdrawn', publishable: false, localAction: 'withdraw' }));
  assert(withdrawn.action === 'DELETE', 'hidden product → DELETE live post');
  const keep = resolveRemoteIntent(intentInput({ publishable: false, localAction: 'withdraw', withdrawAction: 'KEEP' }));
  assert(keep.action === 'none' && keep.reason === 'withdraw_keep', 'KEEP leaves the post');
  const twice = resolveRemoteIntent(intentInput({ publishable: false, localAction: 'withdraw', previousStatus: 'WITHDRAWN' }));
  assert(twice.action === 'none' && twice.reason === 'already_withdrawn', 'second withdraw is a no-op');
  const neverPosted = resolveRemoteIntent(intentInput({ publishable: false, hasRemoteMessage: false, localAction: 'skip' }));
  assert(neverPosted.action === 'none', 'hidden product without post does nothing');

  // remote intent: out of stock via OOS policy
  const oosUnchosen = resolveRemoteIntent(intentInput({ eventType: 'product.stock_changed', available: false, localAction: 'refresh' }));
  assert(oosUnchosen.action === 'none' && oosUnchosen.reason === 'oos_unchosen', 'OOS ignored until policy is chosen');
  const oosDelete = resolveRemoteIntent(intentInput({ eventType: 'product.stock_changed', available: false, oosChosen: true, oosPolicy: 'DELETE', localAction: 'withdraw' }));
  assert(oosDelete.action === 'DELETE', 'OOS DELETE policy deletes');
  const oosHide = resolveRemoteIntent(intentInput({ eventType: 'product.stock_changed', available: false, oosChosen: true, oosPolicy: 'HIDE', localAction: 'withdraw' }));
  assert(oosHide.action === 'UPDATE' && oosHide.notice === true, 'OOS HIDE edits to the notice');
  const oosHideAgain = resolveRemoteIntent(intentInput({ eventType: 'product.stock_changed', available: false, oosChosen: true, oosPolicy: 'HIDE', localAction: 'withdraw', previousStatus: 'WITHDRAWN' }));
  assert(oosHideAgain.action === 'none', 'notice sent once');
  const oosUpdateStock = resolveRemoteIntent(intentInput({ eventType: 'product.stock_changed', available: false, oosChosen: true, oosPolicy: 'UPDATE' }));
  assert(oosUpdateStock.action === 'none', 'UPDATE policy keeps the post on stock events');
  const oosUpdatePrice = resolveRemoteIntent(intentInput({ eventType: 'product.price_changed', available: false, oosChosen: true, oosPolicy: 'UPDATE' }));
  assert(oosUpdatePrice.action === 'UPDATE', 'UPDATE policy still refreshes chosen content edits while OOS');
  const oosNoCreate = resolveRemoteIntent(intentInput({ eventType: 'product.created', available: false, oosChosen: true, oosPolicy: 'UPDATE', hasRemoteMessage: false, localAction: 'create', previousStatus: null }));
  assert(oosNoCreate.action === 'none', 'out-of-stock product is never posted');

  // remote intent: restock
  const restockHide = resolveRemoteIntent(intentInput({ eventType: 'product.stock_changed', localAction: 'reopen', previousStatus: 'WITHDRAWN', oosChosen: true, oosPolicy: 'HIDE' }));
  assert(restockHide.action === 'UPDATE' && restockHide.notice === false, 'restock after HIDE restores the full post');
  const restockDelete = resolveRemoteIntent(intentInput({ eventType: 'product.stock_changed', localAction: 'reopen', previousStatus: 'WITHDRAWN', oosChosen: true, oosPolicy: 'DELETE', hasRemoteMessage: false }));
  assert(restockDelete.action === 'CREATE', 'restock after DELETE recreates the post');
  const stockNoise = resolveRemoteIntent(intentInput({ eventType: 'product.stock_changed', localAction: 'refresh' }));
  assert(stockNoise.action === 'none' && stockNoise.reason === 'stock_only', 'ordinary stock movement does not edit');
  const restockUnchosen = resolveRemoteIntent(intentInput({ eventType: 'product.stock_changed', localAction: 'reopen', previousStatus: 'WITHDRAWN', hasRemoteMessage: false }));
  assert(restockUnchosen.action === 'none', 'restock without OOS DELETE policy does not create');

  console.log('publication-automation.spec.ts: ok');
}

main();

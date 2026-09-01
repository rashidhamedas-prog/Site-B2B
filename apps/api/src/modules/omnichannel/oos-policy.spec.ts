/**
 * npx ts-node --transpile-only src/modules/omnichannel/oos-policy.spec.ts
 */
import { isAllowedSecretRef } from './omnichannel-secrets';
import {
  annotatePreviewOos,
  assertOmnichannelSettingsInput,
  findCanaryDestinationId,
  liveOosRejectReason,
  parseStoredOmnichannelSettings,
  readChannelOos,
  resolveOosDecision,
  sanitizeDestinationSettings,
  selectCanaryTelegramDestinations,
} from './oos-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const oos = resolveOosDecision({
    channel: 'RETAIL',
    available: false,
    hasRemoteMessage: true,
    policy: 'UPDATE',
    chosen: false,
  });
  assert(oos.remote === 'none', 'unchosen remote none');
  assert(oos.source === 'default', 'unchosen source default');
  assert(oos.policy === 'UPDATE', 'display fallback UPDATE');
  assert(oos.local === 'refresh', 'unchosen local refresh');
}

{
  const oos = resolveOosDecision({
    channel: 'RETAIL',
    available: false,
    hasRemoteMessage: true,
    policy: 'UPDATE',
    chosen: true,
  });
  assert(oos.remote === 'UPDATE', 'chosen UPDATE + remote message');
  assert(oos.source === 'admin', 'chosen source admin');
}

{
  const retail = readChannelOos({ retailOosPolicy: 'HIDE', retailOosChosen: true }, 'RETAIL');
  assert(retail.chosen === true && retail.policy === 'HIDE', 'retail chosen HIDE');
  const wholesale = readChannelOos({ retailOosPolicy: 'HIDE', retailOosChosen: true }, 'WHOLESALE');
  assert(wholesale.chosen === false && wholesale.policy === 'UPDATE', 'wholesale ignores retail policy');
  assert(
    readChannelOos({ wholesaleOosPolicy: 'DELETE' }, 'WHOLESALE').policy === 'UPDATE',
    'unchosen displays UPDATE',
  );
}

{
  const hideNew = resolveOosDecision({
    channel: 'RETAIL',
    available: false,
    hasRemoteMessage: false,
    policy: 'HIDE',
    chosen: true,
  });
  assert(hideNew.local === 'skip_create' && hideNew.remote === 'none', 'HIDE never published skips');
  const hideLive = resolveOosDecision({
    channel: 'RETAIL',
    available: false,
    hasRemoteMessage: true,
    policy: 'HIDE',
    chosen: true,
  });
  assert(hideLive.remote === 'UPDATE' && hideLive.local === 'withdraw_local', 'HIDE remote edits text not delete');
}

{
  const delNew = resolveOosDecision({
    channel: 'WHOLESALE',
    available: false,
    hasRemoteMessage: false,
    policy: 'DELETE',
    chosen: true,
  });
  assert(delNew.local === 'skip_create' && delNew.remote === 'none', 'DELETE never published skips');
  const delLive = resolveOosDecision({
    channel: 'WHOLESALE',
    available: false,
    hasRemoteMessage: true,
    policy: 'DELETE',
    chosen: true,
  });
  assert(delLive.remote === 'DELETE' && delLive.local === 'withdraw_local', 'DELETE remote deletes');
}

{
  const instock = resolveOosDecision({
    channel: 'RETAIL',
    available: true,
    hasRemoteMessage: false,
    policy: 'HIDE',
    chosen: true,
  });
  assert(instock.remote === 'CREATE' && instock.local === 'refresh', 'in-stock ignores OOS hide');
  const instockLive = resolveOosDecision({
    channel: 'RETAIL',
    available: true,
    hasRemoteMessage: true,
    policy: 'DELETE',
    chosen: true,
  });
  assert(instockLive.remote === 'UPDATE', 'in-stock live updates');
}

{
  let threw = false;
  try {
    assertOmnichannelSettingsInput({ retailOosPolicy: 'ARCHIVE' });
  } catch {
    threw = true;
  }
  assert(threw, 'invalid policy rejected');

  threw = false;
  try {
    assertOmnichannelSettingsInput({
      retailOosPolicy: 'UPDATE',
      token: '7123456789:AAHrealTelegramTokenValueXX',
    });
  } catch {
    threw = true;
  }
  assert(threw, 'token-shaped settings body rejected');

  threw = false;
  try {
    sanitizeDestinationSettings({ note: 'hidden', isCanary: true });
  } catch {
    threw = true;
  }
  assert(threw, 'destination settings allowlist');
}

assert(isAllowedSecretRef('TELEGRAM_BOT_TOKEN') === true, 'telegram ref allowed');
assert(isAllowedSecretRef('123:AArealTelegramTokenValueXXXX') === false, 'token value rejected');
assert(isAllowedSecretRef('DATABASE_URL') === false, 'DATABASE_URL rejected');

{
  const dests = [
    { id: 'd1', connectionId: 'c1', enabled: true, settings: {} },
    { id: 'd2', connectionId: 'c1', enabled: true, settings: { isCanary: true } },
  ];
  const conns = [
    { id: 'c1', provider: 'TELEGRAM', channel: 'RETAIL', status: 'ACTIVE' },
  ];
  assert(selectCanaryTelegramDestinations(dests, conns, 'RETAIL').map((d) => d.id).join(',') === 'd2', 'canary only');
  assert(selectCanaryTelegramDestinations(dests.filter((d) => d.id === 'd1'), conns, 'RETAIL').length === 0, 'unset canary enqueues zero');
  assert(selectCanaryTelegramDestinations(dests, [{ ...conns[0], status: 'DISABLED' }], 'RETAIL').length === 0, 'disabled connection skipped');
  assert(selectCanaryTelegramDestinations(dests, conns, 'WHOLESALE').length === 0, 'other channel skipped');
  assert(findCanaryDestinationId(dests, conns, 'RETAIL') === 'd2', 'canary id');
  assert(findCanaryDestinationId(dests, conns, 'WHOLESALE') === null, 'no wholesale canary');
}

{
  const stored = parseStoredOmnichannelSettings({
    retailOosPolicy: 'HIDE',
    retailOosChosen: true,
    token: 'nope',
    wholesaleOosPolicy: 'DELETE',
  });
  assert(stored.retailOosPolicy === 'HIDE' && stored.retailOosChosen === true, 'allowlisted retail saved');
  assert(stored.wholesaleOosChosen !== true, 'policy without chosen stays unchosen');
  assert(!('token' in stored), 'unknown keys dropped');
}

{
  const note = annotatePreviewOos({ available: false, stock: 0 }, resolveOosDecision({
    channel: 'RETAIL',
    available: false,
    hasRemoteMessage: false,
    policy: 'UPDATE',
    chosen: true,
  }));
  assert(note.available === false && note.stock === 0, 'preview keeps retail stock');
  assert(note.oosRemoteAction === 'CREATE' && note.oosPolicySource === 'admin', 'preview remote from stored');
}

{
  const reject = liveOosRejectReason(resolveOosDecision({
    channel: 'RETAIL',
    available: false,
    hasRemoteMessage: false,
    policy: 'HIDE',
    chosen: true,
  }), false);
  assert(reject === 'oos_hide_skip', 'live HIDE OOS rejected');
}

console.log('oos-policy.spec.ts: ok');

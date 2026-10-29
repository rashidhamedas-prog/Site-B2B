/**
 * npx ts-node --transpile-only src/modules/omnichannel/canary-live-guard.spec.ts
 */
import {
  BALE_CANARY_CHAT_ID,
  assertCanaryToggleAllowed,
  isDocumentedBaleCanaryKey,
  looksLikeLivePrimaryChannel,
} from './canary-live-guard';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  assert(isDocumentedBaleCanaryKey(BALE_CANARY_CHAT_ID), 'chat id');
  assert(isDocumentedBaleCanaryKey('@toliditaranom'), 'username');
  assert(isDocumentedBaleCanaryKey('TolidiTaranom'), 'case');
  assert(!isDocumentedBaleCanaryKey('999'), 'other key');
}

{
  const dual = assertCanaryToggleAllowed({
    wantCanary: true,
    destinationKey: BALE_CANARY_CHAT_ID,
    provider: 'BALE',
    channel: 'WHOLESALE',
    verifiedCanPost: true,
  });
  assert(dual.ok === true && dual.canaryIsLivePrimaryWarning === true, 'bale dual-role allowed with warning');
}

{
  const rubika = assertCanaryToggleAllowed({
    wantCanary: true,
    destinationKey: '@Toliditaranom_omde',
    provider: 'RUBIKA',
    channel: 'WHOLESALE',
  });
  assert(rubika.ok === false && rubika.code === 'blocked_rubika_wholesale_canary', 'rubika wholesale blocked');
}

{
  const live = looksLikeLivePrimaryChannel({
    destinationKey: '-100123',
    displayName: 'کانال عمده زنده',
    provider: 'TELEGRAM',
    channel: 'WHOLESALE',
    verifiedCanPost: true,
  });
  assert(live.livePrimary === true, 'verified live name');

  const denied = assertCanaryToggleAllowed({
    wantCanary: true,
    destinationKey: '-100123',
    displayName: 'کانال عمده زنده',
    provider: 'TELEGRAM',
    channel: 'WHOLESALE',
    verifiedCanPost: true,
  });
  assert(denied.ok === false && denied.code === 'live_primary_needs_force', 'needs force');

  const forced = assertCanaryToggleAllowed({
    wantCanary: true,
    destinationKey: '-100123',
    displayName: 'کانال عمده زنده',
    provider: 'TELEGRAM',
    channel: 'WHOLESALE',
    verifiedCanPost: true,
    forceCanaryOnLive: true,
    goRef: 'GO حامد test',
  });
  assert(forced.ok === true, 'force+goRef allows');
}

{
  const off = assertCanaryToggleAllowed({
    wantCanary: false,
    destinationKey: '@Toliditaranom_omde',
    provider: 'RUBIKA',
    channel: 'WHOLESALE',
  });
  assert(off.ok === true, 'clearing canary always ok');
}

console.log('canary-live-guard.spec.ts: ok');

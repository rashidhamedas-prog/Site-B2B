/**
 * npx ts-node --transpile-only src/modules/omnichannel/cross-channel-contamination.spec.ts
 */
import {
  assertNoCrossChannelContamination,
  channelSettingsTextBlob,
  findCrossChannelContamination,
} from './cross-channel-contamination';
import { emptyChannelContentSettings } from './channel-settings';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const siblings = [
  {
    destinationId: 'dest-b',
    channelLink: 'https://t.me/otherchannel',
    contactId: 'contact-B',
    orderBotUsername: 'OtherOrderBot',
  },
  {
    destinationId: 'dest-a',
    channelLink: 'https://ble.ir/self',
    contactId: 'contact-A',
  },
];

const clean = findCrossChannelContamination('کپشن تمیز بدون لینک بیگانه', 'dest-a', siblings);
assert(clean.length === 0, 'no false positive');

const dirty = findCrossChannelContamination(
  'سفارش از https://t.me/otherchannel و @OtherOrderBot',
  'dest-a',
  siblings,
);
assert(dirty.length >= 2, 'detects link + order bot');
assert(dirty.every((h) => h.siblingDestinationId === 'dest-b'), 'points at sibling B');

const selfOk = findCrossChannelContamination(
  'لینک خودم https://ble.ir/self',
  'dest-a',
  siblings,
);
assert(selfOk.length === 0, 'own markers ignored');

try {
  assertNoCrossChannelContamination('برو به https://t.me/otherchannel', 'dest-a', siblings);
  assert(false, 'must throw on activate path');
} catch (err) {
  assert(
    err instanceof Error && (err as Error & { code?: string }).code === 'cross_channel_contamination',
    'contamination code',
  );
}

const blob = channelSettingsTextBlob({
  ...emptyChannelContentSettings(),
  footerText: 'فوتر',
  channelLink: 'https://example.com/x',
});
assert(blob.includes('فوتر') && blob.includes('https://example.com/x'), 'blob joins text fields');

console.log('cross-channel-contamination.spec.ts: ok');

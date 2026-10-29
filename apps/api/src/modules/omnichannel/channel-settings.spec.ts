/**
 * npx ts-node --transpile-only src/modules/omnichannel/channel-settings.spec.ts
 */
import {
  appendUtmToUrl,
  applyShowPriceToVars,
  assertChannelContentInput,
  assertNoForbiddenProductClaims,
  channelSettingsBlob,
  copyChannelContent,
  emptyChannelContentSettings,
  findForbiddenProductClaim,
  formatMinOrderQty,
  mergeChannelContentSettingsPatch,
  parseChannelContentSettings,
  writeChannelSettingsIntoPublish,
} from './channel-settings';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const empty = emptyChannelContentSettings();
assert(empty.showPriceDefault === false, 'showPriceDefault default false');
assert(
  empty.contactId === ''
    && empty.ownerChatId === ''
    && empty.orderBotId === ''
    && empty.orderBotUsername === ''
    && empty.utmSource === ''
    && empty.botUsername === ''
    && empty.footerText === '',
  'no invented LIVE ids',
);

const nested = parseChannelContentSettings({
  channelSettings: {
    contactId: 'from-nested',
    ownerChatId: '',
    showPriceDefault: true,
    footerText: 'فوتر تست',
    orderBotUsername: '@OrderBot',
  },
  contactId: 'flat-ignored-when-nested-wins-merge',
});
assert(nested.contactId === 'from-nested', 'nested channelSettings wins for present keys');
assert(nested.showPriceDefault === true && nested.footerText === 'فوتر تست', 'nested fields');
assert(nested.orderBotUsername === 'OrderBot', 'strips @ from orderBotUsername');

const flatCompat = parseChannelContentSettings({
  contactId: 'flat-only',
  showPrice: true,
  utmSource: 'bale',
});
assert(flatCompat.contactId === 'flat-only' && flatCompat.showPriceDefault === true, 'flat compat');

const a = parseChannelContentSettings({ contactId: 'tg-retail', utmSource: 'telegram', footerText: 'A' });
const b = parseChannelContentSettings({ contactId: 'bale-wholesale', utmSource: 'bale', footerText: 'B' });
assert(a.contactId !== b.contactId && a.footerText !== b.footerText, 'destinations isolate content');

const merged = mergeChannelContentSettingsPatch(a, { showPriceDefault: true, contactId: '  next  ' });
assert(merged.showPriceDefault === true && merged.contactId === 'next', 'merge trims');

assert(formatMinOrderQty(6) === '6', 'minOrder from product field');
assert(formatMinOrderQty(1) === '1', 'minOrder 1 still from product');
assert(formatMinOrderQty(0) === '' && formatMinOrderQty(null) === '', 'invalid minOrder empty');

assert(
  appendUtmToUrl('https://www.poshaktaranom.ir/products/x', { utmSource: 'bale', utmCampaign: 'c1' })
    .includes('utm_source=bale'),
  'UTM append',
);
assert(
  appendUtmToUrl('https://www.poshaktaranom.ir/products/x', {}) === 'https://www.poshaktaranom.ir/products/x',
  'no invented UTM',
);

const priced = applyShowPriceToVars({ price: '100', packPrice: '600' }, false);
assert(priced.price === '' && priced.packPrice === '', 'showPrice false blanks price');

assert(findForbiddenProductClaim('ضدآب و سبک') === 'ضدآب', 'finds ضدآب');
assert(findForbiddenProductClaim('ضد آب') === 'ضدآب', 'finds spaced form');
assert(findForbiddenProductClaim('ضد‌آب') === 'ضدآب', 'finds ZWNJ form');
assert(findForbiddenProductClaim('مقاوم در برابر نم') === null, 'allowed alternate ok');
try {
  assertNoForbiddenProductClaims('کاپشن ضدآب');
  assert(false, 'must throw');
} catch (err) {
  assert(err instanceof Error && err.message.includes('ضدآب'), 'Persian claim error');
}

const copied = copyChannelContent(b);
assert(copied.contactId === b.contactId && copied !== b, 'copy values not same ref');

const written = writeChannelSettingsIntoPublish(
  { seeded: true, autoDailyCap: 5, contactId: 'stale-flat' },
  emptyChannelContentSettings(),
);
assert(
  written.channelSettings && typeof written.channelSettings === 'object',
  'writes nested channelSettings',
);
assert(written.contactId === undefined, 'strips flat content key');
assert(written.autoDailyCap === 5, 'keeps automation');
assert(
  Object.keys(channelSettingsBlob(empty)).every((k) => {
    const bag = channelSettingsBlob(empty) as Record<string, unknown>;
    return bag[k] === undefined || bag[k] === false;
  }),
  'empty blob has no invented strings',
);

try {
  assertChannelContentInput({ token: 'x' });
  assert(false, 'reject secrets/unknown');
} catch {
  /* expected */
}
try {
  assertChannelContentInput({ channelLink: 'http://insecure.example' });
  assert(false, 'reject non-https');
} catch (err) {
  assert(err instanceof Error && err.message === 'invalid_channel_link', 'https only');
}
try {
  assertChannelContentInput({ footerText: 'این پارچه ضد‌آب است' });
  assert(false, 'reject claim in footer');
} catch (err) {
  assert(err instanceof Error && (err as Error & { code?: string }).code === 'forbidden_product_claim', 'claim code');
}

console.log('channel-settings.spec.ts: ok');

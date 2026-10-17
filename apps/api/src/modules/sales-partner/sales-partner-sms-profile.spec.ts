import {
  composeCustomerConfirmationSms,
  parsePartnerSmsIdentity,
  presentSmsProfile,
} from './sales-partner-sms-profile';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const url = 'https://www.poshaktaranom.ir/confirm/sales-partner/token';
const plain = composeCustomerConfirmationSms({ displayName: 'نگار', confirmUrl: url });
assert(plain.includes('نگار'), 'falls back to display name');
assert(plain.includes('تأیید نکنید'), 'locked confirmation sentence');
assert(plain.includes('پرداخت فقط به پوشاک ترنم است'), 'payment stays with the store');
assert(plain.trim().endsWith(url), 'url is server owned and last');
assert(!plain.includes('درآمد تضمینی'), 'no hype');

const branded = composeCustomerConfirmationSms({
  displayName: 'نگار',
  confirmUrl: url,
  shopName: 'مزون سارا',
  greeting: 'سلام، سبد شما آماده است',
  channel: 'instagram',
  handle: '@Sara.Shop',
});
assert(branded.includes('مزون سارا') && !branded.includes('همکار فروش نگار'), 'shop name replaces legal name');
assert(branded.startsWith('سلام، سبد شما آماده است'), 'greeting is the only free line');
assert(branded.includes('اینستاگرام: @Sara.Shop'), 'handle is shown without a url');

assert(parsePartnerSmsIdentity({ shopName: 'پوشاک ترنم' }).ok === false, 'cannot impersonate the brand');
assert(parsePartnerSmsIdentity({ shopName: 'https://evil.ir' }).ok === false, 'shop url blocked');
assert(parsePartnerSmsIdentity({ greeting: 'واریز به کارت ۶۰۳۷' }).ok === false, 'payment words blocked');
assert(parsePartnerSmsIdentity({ channel: 'instagram', handle: 'a' }).ok === false, 'handle too short');
assert(parsePartnerSmsIdentity({ channel: 'website', handle: 'sara' }).ok === false, 'unknown channel');
assert(parsePartnerSmsIdentity({ handle: 'sara' }).ok === false, 'handle needs a channel');
assert(parsePartnerSmsIdentity({ channel: 'telegram' }).ok === false, 'channel needs a handle');
const ok = parsePartnerSmsIdentity({ shopName: 'مزون سارا', channel: 'bale', handle: '@sara_shop' });
assert(ok.ok && ok.ok && ok.value.handle === 'sara_shop' && ok.value.channel === 'bale', 'handle strips @');

const poisoned = presentSmsProfile({
  displayName: 'نگار',
  smsShopName: 'https://phish.ir',
  smsGreeting: 'رمز یکبار',
  smsChannel: 'instagram',
  smsHandle: 'ok',
});
assert(poisoned.shopName === '' && poisoned.greeting === '', 'corrupt stored profile is not rendered');
assert(poisoned.preview.includes('نگار'), 'corrupt profile falls back to the partner name');

console.log('sales-partner-sms-profile.spec.ts: OK');

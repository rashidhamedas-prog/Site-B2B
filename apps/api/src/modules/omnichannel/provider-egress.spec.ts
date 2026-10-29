/**
 * npx ts-node --transpile-only src/modules/omnichannel/provider-egress.spec.ts
 */
import { BALE_API_DEFAULT, RUBIKA_API_DEFAULT, resolveMessengerApiBase } from './provider-egress';
import { TELEGRAM_API, telegramApiBase } from './adapters/telegram.adapter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function throws(fn: () => void, code: string) {
  try {
    fn();
    throw new Error(`expected ${code}`);
  } catch (err) {
    assert(err instanceof Error && err.message === code, `expected ${code}, got ${(err as Error).message}`);
  }
}

assert(resolveMessengerApiBase('BALE', {}) === BALE_API_DEFAULT, 'BALE default');
assert(resolveMessengerApiBase('RUBIKA', {}) === RUBIKA_API_DEFAULT, 'RUBIKA default');
assert(
  resolveMessengerApiBase('BALE', { BALE_API_URL: 'https://bale-mirror.example/' }) === 'https://bale-mirror.example',
  'BALE override strips trailing slash',
);
assert(
  resolveMessengerApiBase('RUBIKA', { RUBIKA_API_URL: 'https://rubika-mirror.example/v3' }) === 'https://rubika-mirror.example/v3',
  'RUBIKA override',
);
throws(() => resolveMessengerApiBase('BALE', { BALE_API_URL: 'ftp://bad' }), 'bale_api_url_invalid');
throws(() => resolveMessengerApiBase('RUBIKA', { RUBIKA_API_URL: 'not-a-url' }), 'rubika_api_url_invalid');
throws(() => resolveMessengerApiBase('BALE', { BALE_API_URL: 'https://user:pass@host/' }), 'bale_api_url_invalid');

// Telegram path must stay identical to telegramApiBase — BALE/RUBIKA envs must not affect it.
const tgEnv = {
  TELEGRAM_API_URL: 'https://tg-proxy.example/bot-prefix',
  BALE_API_URL: 'https://should-not-touch-telegram.example',
  RUBIKA_API_URL: 'https://also-ignored-for-telegram.example',
};
assert(resolveMessengerApiBase('TELEGRAM', tgEnv) === telegramApiBase(tgEnv), 'TELEGRAM delegates to telegramApiBase');
assert(resolveMessengerApiBase('TELEGRAM', {}) === TELEGRAM_API, 'TELEGRAM default equals official host');
assert(
  resolveMessengerApiBase('TELEGRAM', { BALE_API_URL: 'https://x.example' }) === telegramApiBase({}),
  'BALE_API_URL never changes Telegram base',
);

console.log('provider-egress.spec.ts: ok');

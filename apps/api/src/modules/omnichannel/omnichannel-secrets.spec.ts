/**
 * npx ts-node --transpile-only src/modules/omnichannel/omnichannel-secrets.spec.ts
 */
import { assertNoPlaintextSecrets, isAllowedSecretRef, toPublicConnection, toPublicDestination } from './omnichannel-secrets';
import { resolveTelegramToken, TelegramAdapter } from './adapters/telegram.adapter';
import { BaleAdapter } from './adapters/bale.adapter';
import { RubikaAdapter } from './adapters/rubika.adapter';
import {
  areOmnichannelConnectorsEnabled,
  isOmnichannelAutoPublishEnabled,
} from './omnichannel.constants';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isAllowedSecretRef('TELEGRAM_BOT_TOKEN') === true, 'telegram ref allowed');
assert(isAllowedSecretRef('DATABASE_URL') === false, 'database url not a secretRef');
assert(isAllowedSecretRef('DB_PASS') === false, 'db pass not a secretRef');

const prevDb = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgresql://leak:me@localhost/taranom_db';
assert(resolveTelegramToken('DATABASE_URL') === null, 'does not resolve DATABASE_URL');
if (prevDb === undefined) delete process.env.DATABASE_URL;
else process.env.DATABASE_URL = prevDb;

assertNoPlaintextSecrets({ secretRef: 'TELEGRAM_BOT_TOKEN' });

let threw = false;
try {
  assertNoPlaintextSecrets({ token: '123:ABC' });
} catch {
  threw = true;
}
assert(threw, 'token key rejected');

threw = false;
try {
  assertNoPlaintextSecrets({ name: 'bot123:AASECRETTOKENVALUE' });
} catch {
  threw = true;
}
assert(threw, 'bot token value rejected');

threw = false;
try {
  assertNoPlaintextSecrets({ settings: { note: '7123456789:AAHrealTelegramTokenValueXX' } });
} catch {
  threw = true;
}
assert(threw, 'live telegram token shape in jsonb rejected');

threw = false;
try {
  assertNoPlaintextSecrets({ api_key: 'x' });
} catch {
  threw = true;
}
assert(threw, 'api_key key rejected');

const publicDest = toPublicDestination({
  id: 'd1',
  destinationKey: '-100',
  settings: { note: 'hidden' },
});
assert(!('settings' in publicDest), 'settings stripped from public destination');

const publicRow = toPublicConnection({
  id: '1',
  secretRef: 'TELEGRAM_BOT_TOKEN',
  secret: 'should-not-exist',
} as { id: string; secretRef: string; secret?: string });
assert(publicRow.secretRef === 'TELEGRAM_BOT_TOKEN', 'secretRef kept');
assert(!('password' in publicRow), 'no password on public row');

assert(isOmnichannelAutoPublishEnabled() === false, 'auto-publish off by default');
assert(areOmnichannelConnectorsEnabled() === false, 'connectors off by default');

async function main() {
  for (const adapter of [new TelegramAdapter(), new BaleAdapter(), new RubikaAdapter()]) {
    let disabled = false;
    try {
      await adapter.validateConnection('TELEGRAM_BOT_TOKEN');
    } catch (err) {
      disabled = err instanceof Error && /disabled/i.test(err.message);
    }
    assert(disabled, `${adapter.provider} stays disabled`);
  }
  console.log('omnichannel-secrets.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

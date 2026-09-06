/**
 * npx ts-node --transpile-only src/modules/omnichannel/adapters/connector-gate.spec.ts
 *
 * Gate contract after Bale/Rubika went official:
 *  - global flag off → every provider throws ConnectorDisabledError before any HTTP call;
 *  - global flag on + OMNICHANNEL_DISABLED_PROVIDERS lists a provider → that provider still throws;
 *  - enabled provider with a missing token → invalid_credential, never a network call.
 */
import { ConnectorDisabledError } from './channel-adapter';
import { BaleAdapter } from './bale.adapter';
import { RubikaAdapter } from './rubika.adapter';
import { TelegramAdapter } from './telegram.adapter';
import { isOmnichannelProviderEnabled } from '../omnichannel.constants';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function expectDisabled(work: () => Promise<unknown>, label: string) {
  let disabled = false;
  try {
    await work();
  } catch (err) {
    disabled = err instanceof ConnectorDisabledError;
  }
  assert(disabled, label);
}

function neverFetch(): typeof fetch {
  return (async () => {
    throw new Error('network call while gated');
  }) as unknown as typeof fetch;
}

async function main() {
  const prevFlag = process.env.OMNICHANNEL_CONNECTORS_ENABLED;
  const prevDisabled = process.env.OMNICHANNEL_DISABLED_PROVIDERS;
  const prevBale = process.env.BALE_BOT_TOKEN;
  try {
    const bale = new BaleAdapter();
    const rubika = new RubikaAdapter();
    const telegram = new TelegramAdapter();
    for (const adapter of [bale, rubika, telegram]) adapter.http = neverFetch();

    delete process.env.OMNICHANNEL_CONNECTORS_ENABLED;
    delete process.env.OMNICHANNEL_DISABLED_PROVIDERS;
    await expectDisabled(() => bale.validateConnection('BALE_BOT_TOKEN'), 'Bale gated by global flag');
    await expectDisabled(() => rubika.validateConnection('RUBIKA_BOT_TOKEN'), 'Rubika gated by global flag');
    await expectDisabled(() => telegram.validateConnection('TELEGRAM_BOT_TOKEN'), 'Telegram gated by global flag');
    await expectDisabled(() => bale.create({}), 'Bale create gated');
    await expectDisabled(() => rubika.create({}), 'Rubika create gated');
    await expectDisabled(() => rubika.discoverChats('RUBIKA_BOT_TOKEN'), 'Rubika discover gated');

    process.env.OMNICHANNEL_CONNECTORS_ENABLED = 'true';
    process.env.OMNICHANNEL_DISABLED_PROVIDERS = 'rubika, BALE';
    assert(isOmnichannelProviderEnabled('TELEGRAM') === true, 'Telegram enabled when not listed');
    assert(isOmnichannelProviderEnabled('BALE') === false, 'Bale kill switch (case-insensitive)');
    assert(isOmnichannelProviderEnabled('RUBIKA') === false, 'Rubika kill switch');
    assert(isOmnichannelProviderEnabled('INSTAGRAM') === false, 'unknown provider never enabled');
    await expectDisabled(() => bale.validateConnection('BALE_BOT_TOKEN'), 'Bale per-provider gate');
    await expectDisabled(() => rubika.validateConnection('RUBIKA_BOT_TOKEN'), 'Rubika per-provider gate');

    delete process.env.OMNICHANNEL_DISABLED_PROVIDERS;
    delete process.env.BALE_BOT_TOKEN;
    const missing = await bale.validateConnection('BALE_BOT_TOKEN');
    assert(missing.ok === false && missing.error === 'invalid_credential', 'enabled Bale without token → invalid_credential, no HTTP');
    const wrongPrefix = await rubika.validateConnection('TELEGRAM_BOT_TOKEN');
    assert(wrongPrefix.ok === false && wrongPrefix.error === 'invalid_credential', 'Rubika refuses a TELEGRAM_ secretRef');
  } finally {
    if (prevFlag === undefined) delete process.env.OMNICHANNEL_CONNECTORS_ENABLED;
    else process.env.OMNICHANNEL_CONNECTORS_ENABLED = prevFlag;
    if (prevDisabled === undefined) delete process.env.OMNICHANNEL_DISABLED_PROVIDERS;
    else process.env.OMNICHANNEL_DISABLED_PROVIDERS = prevDisabled;
    if (prevBale === undefined) delete process.env.BALE_BOT_TOKEN;
    else process.env.BALE_BOT_TOKEN = prevBale;
  }
  console.log('connector-gate.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

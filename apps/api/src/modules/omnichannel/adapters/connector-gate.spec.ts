/**
 * npx ts-node --transpile-only src/modules/omnichannel/adapters/connector-gate.spec.ts
 */
import { ConnectorDisabledError } from './channel-adapter';
import { BaleAdapter } from './bale.adapter';
import { RubikaAdapter } from './rubika.adapter';
import { TelegramAdapter } from './telegram.adapter';

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

async function main() {
  const prev = process.env.OMNICHANNEL_CONNECTORS_ENABLED;
  process.env.OMNICHANNEL_CONNECTORS_ENABLED = 'true';
  try {
    const bale = new BaleAdapter();
    const rubika = new RubikaAdapter();
    await expectDisabled(() => bale.validateConnection('BALE_BOT_TOKEN'), 'Bale validate stays gated');
    await expectDisabled(() => bale.preview(), 'Bale preview stays gated');
    await expectDisabled(() => bale.create(), 'Bale create stays gated');
    await expectDisabled(() => rubika.validateConnection('RUBIKA_BOT_TOKEN'), 'Rubika validate stays gated');
    await expectDisabled(() => rubika.create(), 'Rubika create stays gated');
    assert(new TelegramAdapter().constructor.name === 'TelegramAdapter', 'Telegram adapter exists');
  } finally {
    if (prev === undefined) delete process.env.OMNICHANNEL_CONNECTORS_ENABLED;
    else process.env.OMNICHANNEL_CONNECTORS_ENABLED = prev;
  }
  console.log('connector-gate.spec.ts: ok');
}

void main();

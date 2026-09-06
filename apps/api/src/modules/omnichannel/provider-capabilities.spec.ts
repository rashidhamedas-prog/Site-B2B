/**
 * npx ts-node --transpile-only src/modules/omnichannel/provider-capabilities.spec.ts
 */
import {
  PROVIDER_CAPABILITIES,
  capabilitiesFor,
  providerReadiness,
  secretRefConfigured,
} from './provider-capabilities';
import { ChannelAdapterRegistry } from './adapters/adapter-registry';
import { TelegramAdapter } from './adapters/telegram.adapter';
import { BaleAdapter } from './adapters/bale.adapter';
import { RubikaAdapter } from './adapters/rubika.adapter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Matrix facts that the adapters rely on (read from the vendors' docs, 2026-09-06).
assert(PROVIDER_CAPABILITIES.TELEGRAM.textFormat === 'HTML' && PROVIDER_CAPABILITIES.TELEGRAM.album, 'telegram matrix');
assert(PROVIDER_CAPABILITIES.BALE.textFormat === 'MARKDOWN' && PROVIDER_CAPABILITIES.BALE.deleteWindowHours === 48 && !PROVIDER_CAPABILITIES.BALE.silent, 'bale matrix');
assert(PROVIDER_CAPABILITIES.RUBIKA.textFormat === 'METADATA' && !PROVIDER_CAPABILITIES.RUBIKA.album && PROVIDER_CAPABILITIES.RUBIKA.permissionCheck === 'test_post', 'rubika matrix');
assert(PROVIDER_CAPABILITIES.RUBIKA.buttons === 'text-link' && !PROVIDER_CAPABILITIES.RUBIKA.boldOnCaption, 'rubika: link lines, plain captions');
for (const caps of Object.values(PROVIDER_CAPABILITIES)) {
  assert(caps.buttonsOnAlbum === false, `${caps.provider}: no vendor puts buttons on an album`);
  assert(caps.chatIdExamples.length > 0 && caps.chatIdHint.length > 10, `${caps.provider}: admin hints present`);
  assert(/^https:\/\//.test(caps.apiBase), `${caps.provider}: official https base`);
}
assert(capabilitiesFor('rubika').provider === 'TELEGRAM', 'lookup is case-sensitive on stored upper-case values → default');
assert(capabilitiesFor('RUBIKA').provider === 'RUBIKA', 'exact match');
assert(capabilitiesFor('INSTAGRAM').provider === 'TELEGRAM', 'unknown provider falls back');

// Readiness never leaks values.
const env: NodeJS.ProcessEnv = { OMNICHANNEL_CONNECTORS_ENABLED: 'true', BALE_BOT_TOKEN: 'x', RUBIKA_BOT_TOKEN: '   ' };
assert(secretRefConfigured('BALE_BOT_TOKEN', env) === true, 'bale token present');
assert(secretRefConfigured('RUBIKA_BOT_TOKEN', env) === false, 'blank token is not configured');
assert(secretRefConfigured('TELEGRAM_BOT_TOKEN', env) === false, 'missing token');
assert(secretRefConfigured('DATABASE_URL', { DATABASE_URL: 'postgres://x' }) === false, 'non-provider env never reported');
const prevFlag = process.env.OMNICHANNEL_CONNECTORS_ENABLED;
const prevDisabled = process.env.OMNICHANNEL_DISABLED_PROVIDERS;
process.env.OMNICHANNEL_CONNECTORS_ENABLED = 'true';
process.env.OMNICHANNEL_DISABLED_PROVIDERS = 'RUBIKA';
const readiness = providerReadiness(env);
if (prevFlag === undefined) delete process.env.OMNICHANNEL_CONNECTORS_ENABLED; else process.env.OMNICHANNEL_CONNECTORS_ENABLED = prevFlag;
if (prevDisabled === undefined) delete process.env.OMNICHANNEL_DISABLED_PROVIDERS; else process.env.OMNICHANNEL_DISABLED_PROVIDERS = prevDisabled;
assert(readiness.length === 3, 'three providers');
const bale = readiness.find((r) => r.provider === 'BALE');
const rubika = readiness.find((r) => r.provider === 'RUBIKA');
assert(bale?.enabled === true && bale.tokenConfigured === true && bale.defaultSecretRef === 'BALE_BOT_TOKEN', 'bale ready');
assert(rubika?.enabled === false && rubika.tokenConfigured === false, 'rubika killed + no token');
assert(!JSON.stringify(readiness).includes('"x"'), 'token value never serialised');

// Registry maps every provider and refuses unknown ones.
const registry = new ChannelAdapterRegistry(new TelegramAdapter(), new BaleAdapter(), new RubikaAdapter());
assert(registry.for('BALE').provider === 'BALE' && registry.for('rubika').provider === 'RUBIKA', 'registry lookup (case-insensitive)');
assert(registry.has('TELEGRAM') && !registry.has('INSTAGRAM'), 'registry has');
let threw = false;
try {
  registry.for('INSTAGRAM');
} catch (err) {
  threw = err instanceof Error && err.message === 'unknown_provider:INSTAGRAM';
}
assert(threw, 'unknown provider throws loudly');

console.log('provider-capabilities.spec.ts: ok');

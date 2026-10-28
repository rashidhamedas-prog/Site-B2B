/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/omnichannel-composer.service.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const svc = readFileSync(resolve(__dirname, 'omnichannel-composer.service.ts'), 'utf8');
const ctl = readFileSync(resolve(__dirname, '../controllers/omnichannel-admin.controller.ts'), 'utf8');
const omni = readFileSync(resolve(__dirname, 'omnichannel.service.ts'), 'utf8');
const constants = readFileSync(resolve(__dirname, '../omnichannel.constants.ts'), 'utf8');

assert(svc.includes('searchProducts'), 'product search');
assert(svc.includes("channel !== 'RETAIL' && channel !== 'WHOLESALE'"), 'channel required');
assert(svc.includes('SEARCH_LIMIT_MAX = 20'), 'max 20');
assert(svc.includes('async plan('), 'plan orchestration');
assert(svc.includes("destinationIds.length"), '0 destinations guarded');
assert(svc.includes('حداقل یک مقصد انتخاب کنید'), '0 dest → 400 message');
assert(svc.includes('loadComposerDedupeContext'), 'loads liveRemote via omni');
assert(svc.includes('buildComposerPlan'), 'uses pure plan');
assert(!svc.includes('TelegramAdapter'), 'no telegram adapter');
assert(!svc.includes('BaleAdapter'), 'no bale adapter');
assert(!svc.includes('RubikaAdapter'), 'no rubika adapter');
assert(!svc.includes('fetch('), 'no fetch');
assert(!svc.includes('TELEGRAM_API_URL'), 'no egress');
assert(!svc.includes('OMNICHANNEL_CONNECTORS_ENABLED'), 'no connector flip');

assert(ctl.includes("Get('composer/products')"), 'GET composer/products');
assert(ctl.includes("Post('composer/plan')"), 'POST composer/plan');
{
  const productsBlock = ctl.slice(
    ctl.indexOf("@Get('composer/products')"),
    ctl.indexOf("@Post('composer/plan')"),
  );
  assert(productsBlock.includes("@OmnichannelMinRole('PUBLISHER')"), 'PUBLISHER on products');
}
{
  const planBlock = ctl.slice(
    ctl.indexOf("@Post('composer/plan')"),
    ctl.indexOf("@Post('publications')"),
  );
  assert(planBlock.includes("@OmnichannelMinRole('PUBLISHER')"), 'PUBLISHER on plan');
}
assert(ctl.includes('composerUi'), 'status exposes composerUi');

assert(omni.includes('loadComposerDedupeContext'), 'omni exposes dedupe context');
assert(omni.includes('liveRemote = await this.liveRemoteMessages'), 'dry-run loads liveRemote');
assert(
  !/const liveRemote = dryRun\s*\?\s*\[\]/.test(omni),
  'dry-run must not skip liveRemote',
);
assert(omni.includes('plan: composerPlan'), 'createPublication returns plan');
assert(omni.includes('isOmnichannelComposerStrictDestinations'), 'strict destinations gate');
assert(!omni.includes("OMNICHANNEL_CONNECTORS_ENABLED = 'true'"), 'no connector enable');

assert(constants.includes('isOmnichannelComposerUiEnabled'), 'composer UI flag');
assert(constants.includes("OMNICHANNEL_COMPOSER_UI === 'true'"), 'composer UI default off');
assert(constants.includes('isOmnichannelComposerStrictDestinations'), 'strict dest helper');

console.log('omnichannel-composer.service.spec.ts: ok');

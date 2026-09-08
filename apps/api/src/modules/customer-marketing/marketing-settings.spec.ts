/**
 * npx ts-node --transpile-only src/modules/customer-marketing/marketing-settings.spec.ts
 */
import { effectiveMode } from './customer-marketing.constants';
import { resolveMarketingSettings } from './marketing-settings';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const s = resolveMarketingSettings({ enabled: true, mode: 'CANARY', treatRegisterAutoAsPromoConsent: true });
assert(s.enabled === true, 'enabled');
assert(s.mode === 'CANARY', 'mode');
assert(s.treatRegisterAutoAsPromoConsent === true, 'audit flag readable');
assert(s.quietStartHour === 21 && s.quietEndHour === 9, 'tehran quiet default');

const off = resolveMarketingSettings({});
assert(off.enabled === false && off.mode === 'OFF', 'default kill switch');
assert(off.treatRegisterAutoAsPromoConsent === false, 'register_auto is not promo consent');

const previewArmed = resolveMarketingSettings({ enabled: true, mode: 'PREVIEW' });
assert(previewArmed.enabled === false && previewArmed.mode === 'PREVIEW', 'preview cannot arm sender');

assert(effectiveMode('LIVE', 'OFF') === 'OFF', 'scenario off wins');
assert(effectiveMode('OFF', 'LIVE') === 'OFF', 'global off wins');
assert(effectiveMode('CANARY', 'LIVE') === 'CANARY', 'global canary caps live scenario');
assert(effectiveMode('LIVE', 'CANARY') === 'CANARY', 'scenario canary below live');

console.log('marketing-settings.spec.ts: ok');

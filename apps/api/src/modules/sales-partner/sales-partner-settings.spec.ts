import {
  programAllowsApply,
  programAllowsPartnerAction,
  resolveSalesPartnerSettings,
} from './sales-partner-settings';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const off = resolveSalesPartnerSettings(null);
assert(off.enabled === false, 'default off');
assert(off.mode === 'OFF', 'default mode');
assert(off.commissionHoldDays === null, 'no auto hold');
assert(!programAllowsApply(off), 'apply closed');
assert(!programAllowsPartnerAction(off, '09151234567'), 'actions closed');

const live = resolveSalesPartnerSettings({ enabled: true, mode: 'LIVE', applyOpen: true, commissionHoldDays: 14 });
assert(live.enabled === true, 'live enabled');
assert(live.commissionHoldDays === 14, 'hold days');
assert(programAllowsApply(live), 'apply open');
assert(programAllowsPartnerAction(live, '09151234567'), 'live action');

const canary = resolveSalesPartnerSettings({
  enabled: true,
  mode: 'CANARY',
  applyOpen: true,
  canaryPhone: '09151234567',
});
assert(programAllowsPartnerAction(canary, '09151234567'), 'canary phone');
assert(!programAllowsPartnerAction(canary, '09150000000'), 'other phone blocked');

const preview = resolveSalesPartnerSettings({ enabled: true, mode: 'PREVIEW', applyOpen: true });
assert(programAllowsApply(preview), 'preview apply');
assert(!programAllowsPartnerAction(preview, '09151234567'), 'preview cannot create orders');
assert(resolveSalesPartnerSettings({ enabled: true, mode: 'OFF' }).enabled === false, 'off ignores enabled');

console.log('sales-partner-settings.spec.ts: OK');

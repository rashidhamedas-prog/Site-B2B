/**
 * npx ts-node --transpile-only src/modules/customer-marketing/send-gates.spec.ts
 */
import { evaluateSendGate, fillTemplate, recheckDelivery } from './send-gates';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = {
  enabled: true,
  mode: 'LIVE' as const,
  messageClass: 'NURTURE' as const,
  now: new Date('2026-09-08T08:00:00.000Z'), // 11:30 Tehran
  quietStartHour: 21,
  quietEndHour: 9,
  sentNurtureToday: 0,
  sentPromoToday: 0,
  nurtureCap: 1,
  promoCap: 1,
  lastPromoAt: null as Date | null,
  promoMinGapHours: 24,
  channelSentToday: 0,
  dailyCapPerChannel: 20,
  hasTemplate: true,
  hasPhone: true,
};

assert(evaluateSendGate({ ...base, enabled: false }).allow === false, 'disabled');
assert(evaluateSendGate({ ...base, mode: 'OFF' }).allow === false, 'mode off');
assert(evaluateSendGate({ ...base, mode: 'PREVIEW' }).allow === false, 'preview never sends');
assert(evaluateSendGate(base).allow === true, 'live nurture midday');

const night = evaluateSendGate({ ...base, now: new Date('2026-09-07T20:00:00.000Z') });
assert(night.allow === false && 'reason' in night && night.reason === 'QUIET_HOURS', 'quiet hours');

const canary = evaluateSendGate({ ...base, mode: 'CANARY', canaryPhone: '09120000000' });
assert(canary.allow === true && canary.allow && canary.recipientOverride === '09120000000', 'canary rewrite');

assert(evaluateSendGate({ ...base, sentNurtureToday: 1 }).allow === false, 'daily nurture cap');

assert(fillTemplate('{name} سلام {missing}', { name: 'سارا' }) === 'سارا سلام', 'drop empty placeholders');

const kill = recheckDelivery({
  enabled: false, globalMode: 'LIVE', rowMode: 'LIVE', messageClass: 'NURTURE',
  hasCustomerId: true, consent: 'REGISTER_AUTO', suppressed: false,
  treatRegisterAutoAsPromoConsent: false,
});
assert(!kill.allow && 'status' in kill && kill.status === 'SKIPPED' && kill.reason === 'DISABLED', 'delivery honors kill switch');

const revoked = recheckDelivery({
  enabled: true, globalMode: 'LIVE', rowMode: 'LIVE', messageClass: 'NURTURE',
  hasCustomerId: true, consent: 'REVOKED', suppressed: false,
  treatRegisterAutoAsPromoConsent: false,
});
assert(!revoked.allow && 'status' in revoked && revoked.status === 'SUPPRESSED' && revoked.reason === 'REVOKED', 'stale queue after opt-out');

const canaryNoCustomer = recheckDelivery({
  enabled: true, globalMode: 'CANARY', rowMode: 'CANARY', messageClass: 'NURTURE',
  hasCustomerId: false, consent: null, suppressed: false,
  treatRegisterAutoAsPromoConsent: false,
});
assert(canaryNoCustomer.allow === true, 'canary without customer still needs kill-switch only');

const previewArmed = recheckDelivery({
  enabled: true, globalMode: 'PREVIEW', rowMode: 'LIVE', messageClass: 'NURTURE',
  hasCustomerId: true, consent: 'REGISTER_AUTO', suppressed: false,
  treatRegisterAutoAsPromoConsent: false,
});
assert(!previewArmed.allow && 'reason' in previewArmed && previewArmed.reason === 'MODE_OFF', 'global preview cannot deliver live row');

console.log('send-gates.spec.ts: ok');

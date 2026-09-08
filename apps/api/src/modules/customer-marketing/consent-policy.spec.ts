/**
 * npx ts-node --transpile-only src/modules/customer-marketing/consent-policy.spec.ts
 */
import { decideConsent } from './consent-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(decideConsent({
  messageClass: 'NURTURE', consent: 'REGISTER_AUTO', suppressed: false,
  treatRegisterAutoAsPromoConsent: false,
}).allow === true, 'nurture + register_auto');

assert(decideConsent({
  messageClass: 'PROMO', consent: 'REGISTER_AUTO', suppressed: false,
  treatRegisterAutoAsPromoConsent: false,
}).allow === false, 'promo blocked without grant');

assert(decideConsent({
  messageClass: 'PROMO', consent: 'GRANTED', suppressed: false,
  treatRegisterAutoAsPromoConsent: false,
}).allow === true, 'promo + granted');

assert(decideConsent({
  messageClass: 'NURTURE', consent: 'REVOKED', suppressed: false,
  treatRegisterAutoAsPromoConsent: true,
}).allow === false, 'revoked wins');

assert(decideConsent({
  messageClass: 'PROMO', consent: 'GRANTED', suppressed: true,
  treatRegisterAutoAsPromoConsent: false,
}).allow === false, 'suppression wins');

assert(decideConsent({
  messageClass: 'TRANSACTIONAL', consent: 'REVOKED', suppressed: false,
  treatRegisterAutoAsPromoConsent: false,
}).allow === true, 'transactional ignores marketing revoke');

console.log('consent-policy.spec.ts: ok');

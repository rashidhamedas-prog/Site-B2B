import type { ConsentStatus, MessageClass } from './customer-marketing.constants';

export type ConsentDecision =
  | { allow: true }
  | { allow: false; reason: 'REVOKED' | 'SUPPRESSED' | 'PROMO_NEEDS_GRANT' | 'NO_CONSENT' };

export function decideConsent(input: {
  messageClass: MessageClass;
  consent: ConsentStatus | null;
  suppressed: boolean;
  treatRegisterAutoAsPromoConsent: boolean;
}): ConsentDecision {
  if (input.messageClass === 'TRANSACTIONAL') return { allow: true };
  if (input.suppressed) return { allow: false, reason: 'SUPPRESSED' };
  if (input.consent === 'REVOKED') return { allow: false, reason: 'REVOKED' };
  if (!input.consent) return { allow: false, reason: 'NO_CONSENT' };
  if (input.messageClass === 'NURTURE') return { allow: true };
  if (input.consent === 'GRANTED') return { allow: true };
  if (input.consent === 'REGISTER_AUTO' && input.treatRegisterAutoAsPromoConsent) return { allow: true };
  return { allow: false, reason: 'PROMO_NEEDS_GRANT' };
}

/** Pure rules for retail.checkout.abandoned from checkout_intent (no cart server dump). */
export function shouldQueueAbandonedCheckout(input: {
  hasOpenIntent: boolean;
  intentAgeMinutes: number;
  minAgeMinutes: number;
  hasSettledOrderSinceIntent: boolean;
  recentPaymentFailed: boolean;
  alreadyQueued: boolean;
}): boolean {
  if (!input.hasOpenIntent) return false;
  if (input.alreadyQueued) return false;
  if (input.hasSettledOrderSinceIntent) return false;
  if (input.recentPaymentFailed) return false;
  if (input.intentAgeMinutes < input.minAgeMinutes) return false;
  return true;
}

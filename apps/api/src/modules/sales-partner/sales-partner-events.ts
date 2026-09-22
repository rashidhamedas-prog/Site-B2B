export const SALES_PARTNER_EVENT = {
  APPLICATION_SUBMITTED: 'sales_partner.application.submitted',
  PROFILE_STATUS_CHANGED: 'sales_partner.profile.status_changed',
  CONFIRMATION_REQUESTED: 'sales_partner.draft.confirmation_requested',
  CUSTOMER_CONFIRMED: 'sales_partner.draft.customer_confirmed',
  CUSTOMER_REJECTED: 'sales_partner.draft.customer_rejected',
  DRAFT_EXPIRED: 'sales_partner.draft.expired',
  PAYOUT_RECORDED: 'sales_partner.payout.recorded',
} as const;

export function salesPartnerOutboxPayload(input: Record<string, unknown>): Record<string, unknown> {
  const allowed = [
    'applicationId',
    'profileId',
    'draftId',
    'orderId',
    'payoutId',
    'status',
    'action',
  ];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (input[key] !== undefined && input[key] !== null) out[key] = input[key];
  }
  return out;
}

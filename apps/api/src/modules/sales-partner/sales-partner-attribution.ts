export const SALES_SOURCES = ['DIRECT', 'SALES_PARTNER'] as const;
export type SalesSource = (typeof SALES_SOURCES)[number];

export function partnerOrderAttribution(input: {
  draftId: string;
  salesPartnerId: string;
}) {
  return {
    salesSource: 'SALES_PARTNER' as const,
    salesPartnerId: input.salesPartnerId,
    salesPartnerSubmissionId: input.draftId,
    affiliateId: null,
  };
}

export function canAdminChangeAttribution(input: {
  reason: string | null | undefined;
  hasEarnedCommission: boolean;
  nextPartnerActive: boolean;
}): { ok: true } | { ok: false; message: string } {
  const reason = String(input.reason || '').trim();
  if (reason.length < 8) return { ok: false, message: 'دلیل تغییر attribution باید ثبت شود' };
  if (input.hasEarnedCommission) {
    return { ok: false, message: 'بعد از ثبت پورسانت، attribution این سفارش قفل است' };
  }
  if (!input.nextPartnerActive) return { ok: false, message: 'همکار مقصد باید فعال باشد' };
  return { ok: true };
}

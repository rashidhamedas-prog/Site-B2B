export const RISK_FLAG_CODES = [
  'HIGH_DRAFT_VOLUME',
  'HIGH_NO_CONFIRM',
  'HIGH_EXPIRE',
  'HIGH_REJECT',
  'REPEAT_CUSTOMER',
] as const;
export type SalesPartnerRiskFlag = (typeof RISK_FLAG_CODES)[number];

const RISK_FLAG_LABELS: Record<SalesPartnerRiskFlag, string> = {
  HIGH_DRAFT_VOLUME: 'حجم پیش‌سفارش بالا',
  HIGH_NO_CONFIRM: 'نرخ تأیید مشتری پایین',
  HIGH_EXPIRE: 'انقضای زیاد لینک تأیید',
  HIGH_REJECT: 'رد زیاد توسط مشتری',
  REPEAT_CUSTOMER: 'تکرار یک شماره مشتری',
};

export function evaluateSalesPartnerRisk(input: {
  draftsLast24h: number;
  decided: number;
  converted: number;
  expired: number;
  rejected: number;
  maxPhoneRepeats: number;
}): SalesPartnerRiskFlag[] {
  const flags: SalesPartnerRiskFlag[] = [];
  if (input.draftsLast24h >= 15) flags.push('HIGH_DRAFT_VOLUME');
  if (input.decided >= 5) {
    if (input.converted / input.decided < 0.3) flags.push('HIGH_NO_CONFIRM');
    if (input.expired / input.decided >= 0.5) flags.push('HIGH_EXPIRE');
    if (input.rejected / input.decided >= 0.4) flags.push('HIGH_REJECT');
  }
  if (input.maxPhoneRepeats >= 4) flags.push('REPEAT_CUSTOMER');
  return flags;
}

export function humanRiskFlags(flags: string[] | null | undefined): string[] {
  return (flags || []).map((flag) => (
    (RISK_FLAG_LABELS as Record<string, string>)[flag] || 'نیاز به بررسی دستی'
  ));
}

export function maxPhoneRepeats(phones: Array<string | null | undefined>): number {
  const counts = new Map<string, number>();
  let max = 0;
  for (const raw of phones) {
    const phone = String(raw || '').trim();
    if (!phone) continue;
    const next = (counts.get(phone) || 0) + 1;
    counts.set(phone, next);
    if (next > max) max = next;
  }
  return max;
}

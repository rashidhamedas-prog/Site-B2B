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

const PUBLIC_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

export function salesPartnerPublicCode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += PUBLIC_CODE_ALPHABET[bytes[i] % PUBLIC_CODE_ALPHABET.length];
  }
  return out;
}

export function normalizeSalesPartnerCode(raw: unknown): string | null {
  const code = String(raw ?? '').trim().toLowerCase();
  return /^[a-z0-9]{8}$/.test(code) ? code : null;
}

export function salesPartnerSharePath(code: string, slug: string): string {
  return `/go/sp/${code}/${encodeURIComponent(slug)}`;
}

/** Last partner wins. Only products that were clicked, are in this cart, and are eligible. */
export function attributeLinkProducts(input: {
  partnerActive: boolean;
  selfReferral: boolean;
  requestedProductIds: string[];
  cartProductIds: string[];
  eligibleProductIds: string[];
}): string[] {
  if (!input.partnerActive || input.selfReferral) return [];
  const cart = new Set(input.cartProductIds);
  const eligible = new Set(input.eligibleProductIds);
  const seen = new Set<string>();
  const productIds: string[] = [];
  for (const id of input.requestedProductIds) {
    if (seen.has(id) || !cart.has(id) || !eligible.has(id)) continue;
    seen.add(id);
    productIds.push(id);
    if (productIds.length >= 12) break;
  }
  return productIds;
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

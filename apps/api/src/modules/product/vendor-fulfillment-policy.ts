/** Dropship SKU rules — no Nest. HTTP mapping stays in ProductService. */

export const COMMISSION_PERCENT_MIN = 0;
export const COMMISSION_PERCENT_MAX = 90;
export const PUBLIC_BRAND_NAME_MAX = 80;

export const VENDOR_FULFILLMENT_STRIP_KEYS = ['vendorId', 'commissionPercent'] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type VendorFulfillmentState = {
  vendorId: string | null;
  commissionPercent: number | null;
  brandName: string | null;
  showOnWholesale: boolean;
  showOnRetail: boolean;
};

export function stripVendorFulfillmentFields<T extends object>(row: T): T {
  const rec = row as Record<string, unknown>;
  for (const key of VENDOR_FULFILLMENT_STRIP_KEYS) {
    delete rec[key];
  }
  return row;
}

export function parseCommissionPercent(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
  if (!Number.isInteger(n) || n < COMMISSION_PERCENT_MIN || n > COMMISSION_PERCENT_MAX) {
    throw new Error('COMMISSION_PERCENT_INVALID');
  }
  return n;
}

export function parsePublicBrandName(raw: unknown): string | null {
  if (raw == null) return null;
  const name = String(raw).trim();
  if (!name) return null;
  if (name.length > PUBLIC_BRAND_NAME_MAX) throw new Error('BRAND_NAME_TOO_LONG');
  return name;
}

export function normalizeVendorId(raw: unknown): string | null {
  if (raw == null) return null;
  const id = String(raw).trim();
  if (!id) return null;
  if (!UUID_RE.test(id)) throw new Error('INVALID_VENDOR_ID');
  return id;
}

/**
 * null vendorId = Taranom OWN. Assigned SKU is retail-only (not wholesale),
 * commission is required, and public brand is optional (never the partner's name).
 */
export function resolveVendorFulfillment(args: {
  vendorId?: string | null;
  commissionPercent?: number | null;
  brandName?: string | null;
  existingVendorId: string | null;
  existingCommission: number | null;
  existingBrand: string | null;
  showOnWholesale: boolean;
  showOnRetail: boolean;
}): VendorFulfillmentState {
  const vendorId =
    args.vendorId === undefined ? args.existingVendorId : normalizeVendorId(args.vendorId);
  const brandName =
    args.brandName === undefined ? args.existingBrand : parsePublicBrandName(args.brandName);
  const commissionRaw =
    args.commissionPercent === undefined ? args.existingCommission : args.commissionPercent;

  if (!vendorId) {
    return {
      vendorId: null,
      commissionPercent: null,
      brandName,
      showOnWholesale: args.showOnWholesale,
      showOnRetail: args.showOnRetail,
    };
  }

  if (commissionRaw == null || commissionRaw === ('' as unknown)) {
    throw new Error('COMMISSION_REQUIRED');
  }

  return {
    vendorId,
    commissionPercent: parseCommissionPercent(commissionRaw),
    brandName,
    showOnWholesale: false,
    showOnRetail: true,
  };
}

export function publicHideDefaultBrand(
  vendorId: string | null | undefined,
  brandName: string | null | undefined,
): boolean {
  return Boolean(vendorId) && !String(brandName || '').trim();
}

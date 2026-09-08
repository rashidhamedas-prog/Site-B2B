import { DEFAULT_POST_TARIFF } from '../shipping/iran-post-quote';

export type SaleChannel = 'RETAIL' | 'WHOLESALE';

export interface ShippingCompany {
  id: string;
  label: string;
  isActive: boolean;
  sort: number;
}

export interface ShippingPostChannel {
  enabled: boolean;
  originProvince: string;
  originCity: string;
  sameCityBase: number;
  sameProvinceBase: number;
  otherBase: number;
  extraKgFee: number;
  vatPercent: number;
}

export const DEFAULT_RETAIL_COMPANIES: ShippingCompany[] = [
  { id: 'PISHTAZ', label: 'پست پیشتاز', isActive: true, sort: 10 },
  { id: 'TIPAX', label: 'تیپاکس', isActive: true, sort: 20 },
  { id: 'CHAPAR', label: 'چاپار', isActive: true, sort: 30 },
  { id: 'TEHRAN_BIKE', label: 'پیک تهران', isActive: true, sort: 40 },
];

export const DEFAULT_WHOLESALE_COMPANIES: ShippingCompany[] = [
  { id: 'CHAPAR', label: 'چاپار', isActive: true, sort: 10 },
  { id: 'TIPAX', label: 'تیپاکس', isActive: true, sort: 20 },
  { id: 'POST', label: 'پست پیشتاز', isActive: true, sort: 30 },
  { id: 'FREIGHT', label: 'باربری', isActive: true, sort: 40 },
  { id: 'OTHER', label: 'سایر', isActive: true, sort: 50 },
];

export const DEFAULT_SHIPPING_POST: ShippingPostChannel = {
  enabled: false,
  originProvince: 'خراسان رضوی',
  originCity: 'مشهد',
  sameCityBase: DEFAULT_POST_TARIFF.sameCityBase,
  sameProvinceBase: DEFAULT_POST_TARIFF.sameProvinceBase,
  otherBase: DEFAULT_POST_TARIFF.otherBase,
  extraKgFee: DEFAULT_POST_TARIFF.extraKgFee,
  vatPercent: DEFAULT_POST_TARIFF.vatPercent,
};

export function normalizeCompanies(
  raw: unknown,
  fallback: ShippingCompany[],
): ShippingCompany[] {
  const list = Array.isArray(raw) ? raw : null;
  const source = list && list.length ? list : fallback;
  return source
    .map((c: any, i: number) => ({
      id: String(c?.id ?? fallback[i]?.id ?? `SHIP_${i + 1}`),
      label: String(c?.label ?? fallback[i]?.label ?? 'نامشخص'),
      isActive: c?.isActive !== false,
      sort: Number.isFinite(Number(c?.sort)) ? Number(c.sort) : (fallback[i]?.sort ?? (i + 1) * 10),
    }))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

export function resolveChannelCompanies(
  shipping: Record<string, any> | undefined,
  channel: SaleChannel,
): ShippingCompany[] {
  const s = shipping && typeof shipping === 'object' ? shipping : {};
  const nested = channel === 'RETAIL' ? s.retail?.companies : s.wholesale?.companies;
  if (Array.isArray(nested) && nested.length) {
    return normalizeCompanies(
      nested,
      channel === 'RETAIL' ? DEFAULT_RETAIL_COMPANIES : DEFAULT_WHOLESALE_COMPANIES,
    );
  }
  if (channel === 'WHOLESALE') {
    return normalizeCompanies(s.companies, DEFAULT_WHOLESALE_COMPANIES);
  }
  return normalizeCompanies(null, DEFAULT_RETAIL_COMPANIES);
}

function asPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parsePostChannel(
  src: Record<string, any> | undefined,
  legacy: Record<string, any>,
): ShippingPostChannel {
  const merged = { ...legacy, ...(src && typeof src === 'object' ? src : {}) };
  return {
    enabled: merged.enabled === true,
    originProvince: String(merged.originProvince || DEFAULT_SHIPPING_POST.originProvince),
    originCity: String(merged.originCity || DEFAULT_SHIPPING_POST.originCity),
    sameCityBase: asPositiveInt(merged.sameCityBase, DEFAULT_SHIPPING_POST.sameCityBase),
    sameProvinceBase: asPositiveInt(merged.sameProvinceBase, DEFAULT_SHIPPING_POST.sameProvinceBase),
    otherBase: asPositiveInt(merged.otherBase, DEFAULT_SHIPPING_POST.otherBase),
    extraKgFee: asPositiveInt(merged.extraKgFee, DEFAULT_SHIPPING_POST.extraKgFee),
    vatPercent: asPositiveInt(merged.vatPercent, DEFAULT_SHIPPING_POST.vatPercent),
  };
}

export function resolveShippingPost(raw?: unknown): {
  retail: ShippingPostChannel;
  wholesale: ShippingPostChannel;
} {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const hasNested = !!(src.retail || src.wholesale);
  const legacy = hasNested
    ? {}
    : {
        enabled: src.enabled,
        originProvince: src.originProvince,
        originCity: src.originCity,
        sameCityBase: src.sameCityBase,
        sameProvinceBase: src.sameProvinceBase,
        otherBase: src.otherBase,
        extraKgFee: src.extraKgFee,
        vatPercent: src.vatPercent,
      };
  return {
    retail: parsePostChannel(src.retail, legacy),
    wholesale: parsePostChannel(src.wholesale, legacy),
  };
}

export function shippingPostForChannel(
  raw: unknown,
  channel: SaleChannel,
): ShippingPostChannel {
  const both = resolveShippingPost(raw);
  return channel === 'RETAIL' ? both.retail : both.wholesale;
}

export function addressPlace(
  addr?: string | Record<string, unknown> | null,
): { province?: string; city?: string } {
  if (!addr) return {};
  let obj: Record<string, unknown> | null = null;
  if (typeof addr === 'string') {
    try {
      const parsed = JSON.parse(addr);
      obj = parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return {};
    }
  } else if (typeof addr === 'object') {
    obj = addr;
  }
  if (!obj) return {};
  const province = String(obj.province ?? obj.Province ?? '').trim();
  const city = String(obj.city ?? obj.City ?? '').trim();
  return {
    province: province || undefined,
    city: city || undefined,
  };
}

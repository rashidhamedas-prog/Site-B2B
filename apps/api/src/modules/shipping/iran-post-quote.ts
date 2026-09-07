/**
 * Iran Post پیشتاز quote.
 * Live: Tapin public check-price (no secrets). Fallback: editable zone table.
 * Amounts are IRR. Do not treat fallback numbers as a published نرخ‌نامه claim.
 */

export type PostZone = 'same_city' | 'same_province' | 'other';

export interface PostTariff {
  sameCityBase: number;
  sameProvinceBase: number;
  otherBase: number;
  extraKgFee: number;
  vatPercent: number;
}

export const DEFAULT_POST_TARIFF: PostTariff = {
  sameCityBase: 730_000,
  sameProvinceBase: 830_000,
  otherBase: 1_030_000,
  extraKgFee: 180_000,
  vatPercent: 10,
};

/** Tapin-style province codes used by public.api.tapin.ir */
export const IRAN_PROVINCE_CODES: Record<string, number> = {
  تهران: 1,
  البرز: 31,
  اصفهان: 6,
  'خراسان رضوی': 7,
  'خراسان شمالی': 30,
  'خراسان جنوبی': 29,
  فارس: 5,
  خوزستان: 4,
  آذربایجانشرقی: 3,
  'آذربایجان شرقی': 3,
  آذربایجانغربی: 16,
  'آذربایجان غربی': 16,
  گیلان: 2,
  مازندران: 13,
  کرمان: 25,
  کرمانشاه: 19,
  همدان: 17,
  مرکزی: 11,
  قزوین: 8,
  قم: 10,
  سمنان: 9,
  زنجان: 12,
  گلستان: 14,
  اردبیل: 15,
  کردستان: 18,
  لرستان: 20,
  ایلام: 21,
  چهارمحال: 22,
  'چهارمحال و بختیاری': 22,
  کهگیلویه: 23,
  'کهگیلویه و بویراحمد': 23,
  بوشهر: 24,
  هرمزگان: 26,
  سیستان: 27,
  'سیستان و بلوچستان': 27,
  یزد: 28,
};

export function normalizeProvinceName(raw?: string | null): string {
  return String(raw || '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

export function provinceCode(name?: string | null): number | null {
  const n = normalizeProvinceName(name);
  if (!n) return null;
  if (IRAN_PROVINCE_CODES[n]) return IRAN_PROVINCE_CODES[n];
  const hit = Object.keys(IRAN_PROVINCE_CODES).find((k) => n.includes(k) || k.includes(n));
  return hit ? IRAN_PROVINCE_CODES[hit] : null;
}

export function resolvePostZone(input: {
  originProvince?: string;
  destProvince?: string;
  originCity?: string;
  destCity?: string;
}): PostZone {
  const op = normalizeProvinceName(input.originProvince);
  const dp = normalizeProvinceName(input.destProvince);
  const oc = normalizeProvinceName(input.originCity);
  const dc = normalizeProvinceName(input.destCity);
  if (oc && dc && oc === dc) return 'same_city';
  if (op && dp && op === dp) {
    if (dc && (dc.includes('مشهد') || oc.includes('مشهد')) && oc && dc && oc !== dc) {
      return 'same_province';
    }
    if (oc && dc && oc === dc) return 'same_city';
    return oc && dc ? 'same_province' : 'same_province';
  }
  return 'other';
}

export function localPostFeeIrr(weightKg: number, zone: PostZone, tariff: PostTariff = DEFAULT_POST_TARIFF): number {
  const kg = Math.max(0.1, Number(weightKg) || 0.1);
  const billable = Math.max(1, Math.ceil(kg));
  const extra = Math.max(0, billable - 1);
  const base =
    zone === 'same_city'
      ? tariff.sameCityBase
      : zone === 'same_province'
        ? tariff.sameProvinceBase
        : tariff.otherBase;
  const net = base + extra * tariff.extraKgFee;
  const vat = Math.round(net * (Math.max(0, tariff.vatPercent) / 100));
  return net + vat;
}

export async function tapinCheckPrice(input: {
  weightGrams: number;
  goodsPriceIrr: number;
  fromProvince: number;
  toProvince: number;
  fromCity?: number;
  toCity?: number;
  timeoutMs?: number;
}): Promise<{ total: number; sendPrice: number; source: 'tapin' } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), input.timeoutMs ?? 3500);
  try {
    const res = await fetch('https://public.api.tapin.ir/api/v1/post-office/check-price/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        price: String(Math.max(0, Math.round(input.goodsPriceIrr))),
        weight: String(Math.max(100, Math.round(input.weightGrams))),
        order_type: '1',
        pay_type: '1',
        from_province: String(input.fromProvince),
        to_province: String(input.toProvince),
        from_city: String(input.fromCity ?? 1),
        to_city: String(input.toCity ?? 1),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      returns?: { status?: number };
      entries?: { total?: number; send_price?: number };
    };
    if (Number(json?.returns?.status) !== 200) return null;
    const total = Number(json.entries?.total);
    const sendPrice = Number(json.entries?.send_price);
    if (!Number.isFinite(total) || total <= 0) return null;
    return { total: Math.round(total), sendPrice: Math.round(sendPrice || total), source: 'tapin' };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

import { onlyDigits } from './iran-digits';

export const TOROBPAY_MIN_STREET = 8;
export const TOROBPAY_POSTAL_LEN = 10;
export const TOROBPAY_RECIPIENT_MIN = 3;

export type ShippingAddress = {
  recipient: string;
  mobile: string;
  province: string;
  city: string;
  street: string;
  postalCode: string;
  alley?: string;
  plaque?: string;
  unit?: string;
};

export type AddressMode = 'standard' | 'torobpay';

export type AddressField =
  | 'recipient'
  | 'mobile'
  | 'province'
  | 'city'
  | 'street'
  | 'postalCode'
  | 'plaque';

export type AddressErrors = Partial<Record<AddressField, string>>;

export function emptyShippingAddress(): ShippingAddress {
  return {
    recipient: '',
    mobile: '',
    province: 'خراسان رضوی',
    city: 'مشهد',
    street: '',
    postalCode: '',
    alley: '',
    plaque: '',
    unit: '',
  };
}

export function normalizeIranMobile(raw: string): string {
  const digits = onlyDigits(raw);
  if (digits.startsWith('98') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`;
  return digits;
}

export function isValidIranMobile(raw: string): boolean {
  return /^09\d{9}$/.test(normalizeIranMobile(raw));
}

export function postalDigits(raw: string): string {
  return onlyDigits(raw).slice(0, TOROBPAY_POSTAL_LEN);
}

export function isValidIranPostal(raw: string): boolean {
  const digits = postalDigits(raw);
  if (digits.length !== TOROBPAY_POSTAL_LEN) return false;
  if (/^(\d)\1{9}$/.test(digits)) return false;
  return true;
}

export function composeStreetLine(addr: Pick<ShippingAddress, 'street' | 'alley' | 'plaque' | 'unit'>): string {
  const street = String(addr.street || '').trim();
  const alley = String(addr.alley || '').trim();
  const plaque = String(addr.plaque || '').trim();
  const unit = String(addr.unit || '').trim();
  return [
    street,
    alley ? `کوچه ${alley}` : '',
    plaque ? `پلاک ${plaque}` : '',
    unit ? `واحد ${unit}` : '',
  ]
    .filter(Boolean)
    .join('، ');
}

export function streetSignificantLen(addr: Pick<ShippingAddress, 'street' | 'alley' | 'plaque' | 'unit'>): number {
  return composeStreetLine(addr).replace(/\s/g, '').length;
}

export type SavedAddressPayload = {
  recipient: string;
  mobile: string;
  province: string;
  city: string;
  street: string;
  postalCode: string;
};

/** Canonical line for checkout/API. Extra form keys (alley/plaque/unit) are not returned. */
export function finalizeShippingAddress(addr: ShippingAddress): SavedAddressPayload {
  return {
    recipient: String(addr.recipient || '').trim().slice(0, 80),
    mobile: normalizeIranMobile(addr.mobile),
    province: String(addr.province || '').trim().slice(0, 80),
    city: String(addr.city || '').trim().slice(0, 80),
    street: composeStreetLine(addr).slice(0, 500),
    postalCode: postalDigits(addr.postalCode),
  };
}

/** Body for POST/PATCH /auth/me/addresses — never include alley/plaque/unit. */
export function toSavedAddressPayload(
  addr: ShippingAddress,
  extra?: { isDefault?: boolean; id?: string },
): SavedAddressPayload & { isDefault?: boolean; id?: string } {
  const finalized = finalizeShippingAddress(addr);
  return extra?.id
    ? { ...finalized, isDefault: Boolean(extra.isDefault), id: extra.id }
    : { ...finalized, isDefault: Boolean(extra?.isDefault) };
}

export function validateShippingAddress(addr: ShippingAddress, mode: AddressMode): AddressErrors {
  const errors: AddressErrors = {};
  if (String(addr.recipient || '').trim().length < TOROBPAY_RECIPIENT_MIN) {
    errors.recipient = 'نام و نام خانوادگی گیرنده را کامل بنویسید.';
  }
  if (!isValidIranMobile(addr.mobile)) {
    errors.mobile = 'موبایل را مثل ۰۹۱۵۱۲۳۴۵۶۷ بنویسید.';
  }
  if (!String(addr.province || '').trim()) {
    errors.province = 'استان را انتخاب کنید.';
  }
  if (!String(addr.city || '').trim()) {
    errors.city = 'شهر را انتخاب یا بنویسید.';
  }
  const line = composeStreetLine(addr);
  if (!String(addr.street || '').trim()) {
    errors.street = 'خیابان یا محله را بنویسید.';
  } else if (mode === 'torobpay' && streetSignificantLen(addr) < TOROBPAY_MIN_STREET) {
    errors.street = 'برای ترب‌پی خیابان را کامل‌تر بنویسید.';
    if (!String(addr.plaque || '').trim()) {
      errors.plaque = 'پلاک را هم بنویسید تا آدرس کامل شود.';
    }
  } else if (!line) {
    errors.street = 'نشانی را بنویسید.';
  }
  const postal = postalDigits(addr.postalCode);
  if (mode === 'torobpay') {
    if (!isValidIranPostal(addr.postalCode)) {
      errors.postalCode = 'برای ترب‌پی کدپستی باید ۱۰ رقم کامل باشد.';
    }
  } else if (postal.length > 0 && !isValidIranPostal(addr.postalCode)) {
    errors.postalCode = 'کدپستی اگر وارد شود باید ۱۰ رقم باشد.';
  }
  return errors;
}

export function firstAddressError(errors: AddressErrors): string | null {
  return (
    errors.recipient ||
    errors.mobile ||
    errors.province ||
    errors.city ||
    errors.street ||
    errors.plaque ||
    errors.postalCode ||
    null
  );
}

export function torobpayAddressChecklist(addr: ShippingAddress): Array<{ id: string; ok: boolean; label: string }> {
  return [
    { id: 'place', ok: Boolean(addr.province.trim() && addr.city.trim()), label: 'استان و شهر' },
    { id: 'name', ok: addr.recipient.trim().length >= TOROBPAY_RECIPIENT_MIN, label: 'نام کامل گیرنده' },
    { id: 'mobile', ok: isValidIranMobile(addr.mobile), label: 'موبایل ۱۱ رقمی' },
    {
      id: 'street',
      ok: streetSignificantLen(addr) >= TOROBPAY_MIN_STREET,
      label: 'خیابان و پلاک',
    },
    { id: 'postal', ok: isValidIranPostal(addr.postalCode), label: 'کدپستی ۱۰ رقمی' },
  ];
}

export function isAddressReady(addr: ShippingAddress, mode: AddressMode): boolean {
  return Object.keys(validateShippingAddress(addr, mode)).length === 0;
}

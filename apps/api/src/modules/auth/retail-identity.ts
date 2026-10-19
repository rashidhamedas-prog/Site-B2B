/** Retail CRM identity. Placeholder names must not be stored as a real customer. */

export const RETAIL_NAME_PLACEHOLDERS = new Set(['خریدار ترنم', 'نامشخص']);

export function usablePersonName(value?: string | null, max = 80): string | null {
  const name = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  if (name.length < 2) return null;
  if (RETAIL_NAME_PLACEHOLDERS.has(name)) return null;
  return name;
}

export function usablePlace(value?: string | null, max = 80): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  if (text.length < 2) return null;
  return text;
}

export function retailSignupIdentity(input: {
  name?: string | null;
  otpName?: string | null;
  province?: string | null;
  city?: string | null;
}) {
  return {
    name: usablePersonName(input.name) || usablePersonName(input.otpName),
    province: usablePlace(input.province),
    city: usablePlace(input.city),
  };
}

/** Signup used to stamp تهران/تهران with no street. That is not a confirmed address. */
export function isUnconfirmedRetailPlace(customer: {
  province?: string | null;
  city?: string | null;
  address?: string | null;
}): boolean {
  return (
    String(customer.province || '').trim() === 'تهران' &&
    String(customer.city || '').trim() === 'تهران' &&
    !String(customer.address || '').trim()
  );
}

export type RetailIdentityPatch = Partial<{
  ownerName: string;
  businessName: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
}>;

/** Fill only missing or placeholder CRM fields. Never overwrite a real name. */
export function patchRetailCustomerIdentity(
  customer: {
    ownerName?: string | null;
    businessName?: string | null;
    province?: string | null;
    city?: string | null;
    address?: string | null;
    postalCode?: string | null;
  },
  incoming: {
    name?: string | null;
    province?: string | null;
    city?: string | null;
    street?: string | null;
    postalCode?: string | null;
  },
): RetailIdentityPatch {
  const patch: RetailIdentityPatch = {};
  const name = usablePersonName(incoming.name, 120);
  if (name && !usablePersonName(customer.ownerName, 120)) {
    patch.ownerName = name;
  }
  if (name && !usablePersonName(customer.businessName, 160)) {
    patch.businessName = name.slice(0, 160);
  }
  const province = usablePlace(incoming.province);
  const city = usablePlace(incoming.city);
  if (province && city && isUnconfirmedRetailPlace(customer)) {
    patch.province = province;
    patch.city = city;
  }
  const street = String(incoming.street ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (street.length >= 5 && !String(customer.address || '').trim()) {
    patch.address = street;
  }
  const postal = String(incoming.postalCode ?? '').replace(/\D/g, '').slice(0, 10);
  if (postal.length >= 5 && !String(customer.postalCode || '').trim()) {
    patch.postalCode = postal;
  }
  return patch;
}

/** Channel membership checks for a shared phone (D1: retail + wholesale). */

import { isRetailPurpose, isWholesalePurpose } from './staff-access';

export function isB2cCustomer(customer: { type?: string | null; notes?: string | null } | null): boolean {
  if (!customer) return false;
  if (String(customer.type || '').toUpperCase() === 'B2C') return true;
  return (customer.notes || '').includes('فروشگاه آنلاین');
}

export function canEnterRetailShopper(customer: { status: string } | null): boolean {
  if (!customer) return false;
  const status = String(customer.status || '').toUpperCase();
  if (status === 'BLOCKED' || status === 'SUSPENDED') return false;
  return true;
}

/** Null means wholesale portal login is allowed. */
export function wholesalePortalDenial(
  customer: { status: string; type?: string | null; notes?: string | null } | null,
): string | null {
  if (!customer) {
    return 'شماره یا رمز عبور اشتباه است';
  }
  const status = String(customer.status || '').toUpperCase();
  if (status === 'BLOCKED' || status === 'SUSPENDED') {
    return 'حساب شما غیرفعال است. با پشتیبانی تماس بگیرید.';
  }
  if (status === 'PENDING') {
    return 'حساب شما هنوز تأیید نشده است. منتظر تأیید ادمین باشید.';
  }
  if (isB2cCustomer(customer)) {
    return 'این شماره حساب عمده ندارد. از فروشگاه تکی وارد شوید یا از «درخواست عضویت» ثبت‌نام کنید.';
  }
  if (status !== 'ACTIVE') {
    return 'حساب شما غیرفعال است. با پشتیبانی تماس بگیرید.';
  }
  return null;
}

export function isRetailOrderType(type?: string | null): boolean {
  const t = String(type || '').toUpperCase();
  return t === 'RETAIL' || t === 'RETAIL_WEBSITE';
}

/** Non-staff shopper lists are locked to the JWT channel. */
export function shopperOrderScope(
  purpose?: string | null,
): { type: string; channel: 'RETAIL' | 'WHOLESALE' } | null {
  if (isRetailPurpose(purpose)) return { type: 'RETAIL_WEBSITE', channel: 'RETAIL' };
  if (isWholesalePurpose(purpose)) return { type: 'WHOLESALE', channel: 'WHOLESALE' };
  return null;
}

export function shopperCanReadOrderType(purpose?: string | null, orderType?: string | null): boolean {
  const scope = shopperOrderScope(purpose);
  if (!scope) return true;
  const retail = isRetailOrderType(orderType);
  return scope.channel === 'RETAIL' ? retail : !retail;
}

export function omitWholesaleOnlyProfileFields<T extends Record<string, unknown>>(
  profile: T,
  purpose?: string | null,
): T {
  if (!isRetailPurpose(purpose)) return profile;
  const next: Record<string, unknown> = { ...profile };
  delete next.creditLimit;
  delete next.segment;
  delete next.customerCode;
  return next as T;
}

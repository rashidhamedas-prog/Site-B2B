/** Channel membership checks for a shared phone (D1: retail + wholesale). */

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

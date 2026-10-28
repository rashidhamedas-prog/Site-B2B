export type SmsNavLink = { href: string; label: string; exact?: boolean };

export const SMS_NAV_LINKS: SmsNavLink[] = [
  { href: '/admin/sms', label: 'داشبورد', exact: true },
  { href: '/admin/sms/send', label: 'ارسال تکی' },
  { href: '/admin/sms/campaigns/new', label: 'ارسال انبوه' },
  { href: '/admin/sms/templates', label: 'قالب‌ها' },
  { href: '/admin/sms/contacts', label: 'مخاطبان' },
  { href: '/admin/sms/reports', label: 'گزارش‌ها' },
  { href: '/admin/sms/optout', label: 'لغو و سیاه' },
  { href: '/admin/sms/audit', label: 'فعالیت‌ها' },
  { href: '/admin/sms/settings', label: 'تنظیمات' },
];

const MANAGER_ONLY = new Set(['/admin/sms/optout', '/admin/sms/audit', '/admin/sms/settings']);

/** UX only. The API still rejects the wrong role. */
export function smsNavForRole(role: string | null | undefined): SmsNavLink[] {
  const manager = role === 'ADMIN' || role === 'SMS_MANAGER';
  const canCampaign = manager || role === 'SMS_MARKETER';
  return SMS_NAV_LINKS.filter((link) => {
    if (MANAGER_ONLY.has(link.href)) return manager;
    if (link.href.startsWith('/admin/sms/campaigns')) return canCampaign;
    return role === 'ADMIN' || role === 'SMS_MANAGER' || role === 'SMS_OPERATOR' || role === 'SMS_MARKETER';
  });
}

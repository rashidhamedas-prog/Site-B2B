'use client';

import { AdminMenus } from '@/components/admin/AdminMenus';
import { SettingsSection } from './primitives';

export function NavigationTab() {
  return (
    <div className="space-y-5">
      <SettingsSection
        title="منوی تکی و عمده"
        hint="هر کانال منوی خودش را دارد. ذخیره این بخش فقط همان سایت انتخاب‌شده را عوض می‌کند."
      >
        <AdminMenus embedded />
      </SettingsSection>
    </div>
  );
}

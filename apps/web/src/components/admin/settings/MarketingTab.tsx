'use client';

import { AdminBasalamCatalog } from '@/components/admin/AdminBasalamCatalog';
import { SecretField, TextField, ToggleRow } from './fields';
import { SettingsSection } from './primitives';
import type { SettingsPayload } from './types';

export function MarketingTab({
  data,
  showBasalam,
  onToggleBasalam,
  onChange,
}: {
  data: SettingsPayload;
  showBasalam: boolean;
  onToggleBasalam: () => void;
  onChange: (next: SettingsPayload) => void;
}) {
  const m = data.marketing;
  const set = (patch: Partial<SettingsPayload['marketing']>) =>
    onChange({ ...data, marketing: { ...m, ...patch } });

  return (
    <div className="space-y-5">
      <SettingsSection title="ترب و فیدها">
        <ToggleRow
          label="فعال‌سازی همگام‌سازی سفارش ترب"
          value={!!m.torobOrderSyncEnabled}
          onChange={(v) => set({ torobOrderSyncEnabled: v })}
        />
        <p className="font-mono text-xs text-gray-500" dir="ltr">https://www.poshaktaranom.ir/api/v1/feeds/torob.xml</p>
      </SettingsSection>
      <SettingsSection title="Google Analytics">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="GA4 عمده" value={m.ga4WholesaleId} onChange={(v) => set({ ga4WholesaleId: v })} dir="ltr" />
          <TextField label="GA4 تکی" value={m.ga4RetailId} onChange={(v) => set({ ga4RetailId: v })} dir="ltr" />
          <TextField label="GTM عمده" value={m.gtmWholesaleId} onChange={(v) => set({ gtmWholesaleId: v })} dir="ltr" />
          <TextField label="GTM تکی" value={m.gtmRetailId} onChange={(v) => set({ gtmRetailId: v })} dir="ltr" />
        </div>
        <p className="text-xs text-gray-500">توکن تأیید Search Console در بخش سئو است تا با عنوان و OG یک‌جا بماند.</p>
      </SettingsSection>
      <SettingsSection title="پیکسل و پست‌بک">
        <TextField label="نام برند در فید" value={m.feedBrandName} onChange={(v) => set({ feedBrandName: v })} />
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ['yektanetPixelId', 'Yektanet Pixel'],
            ['metaPixelId', 'Meta Pixel'],
            ['adroScriptUrl', 'Adro Script'],
            ['adroAccountId', 'Adro Account'],
            ['afferScriptUrl', 'Affer Script'],
            ['afsonaScriptUrl', 'Afsona Script'],
            ['takhfifanScriptUrl', 'Takhfifan Script'],
            ['yektanetPostbackUrl', 'Yektanet Postback'],
            ['afferPostbackUrl', 'Affer Postback'],
            ['afsonaPostbackUrl', 'Afsona Callback'],
            ['takhfifanPostbackUrl', 'Takhfifan Postback'],
            ['postbackUrl', 'Generic Postback'],
          ] as const).map(([key, label]) => (
            <TextField key={key} label={label} value={m[key] ?? ''} onChange={(v) => set({ [key]: v })} dir="ltr" />
          ))}
        </div>
        <ToggleRow label="ارسال پست‌بک حتی بدون click id" value={!!m.broadcastPostbacks} onChange={(v) => set({ broadcastPostbacks: v })} />
      </SettingsSection>
      <SettingsSection title="باسلام">
        <ToggleRow label="فعال‌سازی همگام‌سازی باسلام" value={!!m.basalamEnabled} onChange={(v) => set({ basalamEnabled: v })} />
        <TextField label="Vendor ID" value={m.basalamVendorId} onChange={(v) => set({ basalamVendorId: v })} dir="ltr" />
        <SecretField label="Access Token" value={m.basalamAccessToken} shown={showBasalam} onToggle={onToggleBasalam} onChange={(v) => set({ basalamAccessToken: v })} />
        <AdminBasalamCatalog />
      </SettingsSection>
    </div>
  );
}

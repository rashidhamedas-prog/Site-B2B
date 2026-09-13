'use client';

import { Building2, Globe, Instagram, Mail, MessageCircle, Phone } from 'lucide-react';
import { EnamadEditor, MediaAssetField, NumberField, TextAreaField, TextField } from './fields';
import { SettingsSection } from './primitives';
import type { SettingsPayload } from './types';

export function BusinessTab({
  data,
  onChange,
}: {
  data: SettingsPayload;
  onChange: (next: SettingsPayload) => void;
}) {
  const biz = data.business;
  const set = (patch: Partial<SettingsPayload['business']>) =>
    onChange({ ...data, business: { ...biz, ...patch } });

  return (
    <div className="space-y-5">
      <SettingsSection title="هویت فروشگاه" hint="نام و راه‌های تماس در فوتر، برگه بسته‌بندی و Organization JSON-LD دیده می‌شود.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="نام برند" value={biz.businessName} onChange={(v) => set({ businessName: v })} icon={<Building2 className="h-4 w-4" />} />
          <TextField label="نام مدیر (نمایش عمومی)" value={biz.ownerName} onChange={(v) => set({ ownerName: v })} />
          <TextField label="شماره تماس" value={biz.phone} onChange={(v) => set({ phone: v })} icon={<Phone className="h-4 w-4" />} dir="ltr" />
          <TextField label="ایمیل" value={biz.email} onChange={(v) => set({ email: v })} icon={<Mail className="h-4 w-4" />} type="email" dir="ltr" />
        </div>
        <TextAreaField label="آدرس کارگاه" value={biz.address} onChange={(v) => set({ address: v })} />
        <TextAreaField label="آدرس دفتر پخش" value={biz.officeAddress} onChange={(v) => set({ officeAddress: v })} />
        <TextField
          label="کدپستی دفتر پخش"
          value={biz.postalCode ?? ''}
          onChange={(v) => set({ postalCode: v })}
          dir="ltr"
          help="۱۰ رقم — روی برگه بسته‌بندی A5 به‌عنوان فرستنده چاپ می‌شود"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="وب‌سایت" value={biz.website} onChange={(v) => set({ website: v })} icon={<Globe className="h-4 w-4" />} dir="ltr" />
          <TextField label="اینستاگرام" value={biz.instagram} onChange={(v) => set({ instagram: v })} icon={<Instagram className="h-4 w-4" />} dir="ltr" />
          <TextField label="تلگرام" value={biz.telegram} onChange={(v) => set({ telegram: v })} icon={<MessageCircle className="h-4 w-4" />} dir="ltr" />
        </div>
        <TextAreaField
          label="پروفایل‌های sameAs (هر خط یک https)"
          value={(biz.sameAs ?? []).join('\n')}
          onChange={(v) => set({ sameAs: v.split(/\n/).map((s) => s.trim()).filter(Boolean) })}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField label="حداقل سفارش (تومان)" value={biz.minOrderToman} onChange={(v) => set({ minOrderToman: v })} />
          <NumberField label="اعتبار پیش‌فرض نسیه (روز)" value={biz.defaultCreditDays} onChange={(v) => set({ defaultCreditDays: v })} />
          <NumberField label="ضریب موجودی محدود" value={biz.limitedStockMultiplier ?? 2} onChange={(v) => set({ limitedStockMultiplier: Math.max(1, v) })} help="برای هر دو سایت" />
          <NumberField label="روزهای نشان جدید" value={biz.newBadgeDays ?? 7} onChange={(v) => set({ newBadgeDays: Math.max(1, v) })} help="برای هر دو سایت" />
        </div>
      </SettingsSection>
      <SettingsSection title="لوگو و معرفی" hint="لوگو و شرح کانال به Organization و Open Graph می‌روند. متن فوتر همچنان از محتوای صفحات است.">
        <MediaAssetField
          label="لوگوی برند"
          url={biz.logoUrl ?? ''}
          alt={biz.logoAlt ?? ''}
          onUrl={(v) => set({ logoUrl: v })}
          onAlt={(v) => set({ logoAlt: v })}
          help="اگر خالی باشد /logo-128.png استفاده می‌شود"
        />
        <TextAreaField
          label="شرح عمده (.com)"
          value={biz.descriptionWholesale ?? ''}
          onChange={(v) => set({ descriptionWholesale: v })}
          rows={3}
        />
        <TextAreaField
          label="شرح تکی (.ir)"
          value={biz.descriptionRetail ?? ''}
          onChange={(v) => set({ descriptionRetail: v })}
          rows={3}
        />
      </SettingsSection>
      <SettingsSection title="نماد اعتماد الکترونیکی">
        <EnamadEditor title="عمده — poshaktaranom.com" value={biz.enamadWholesale} onChange={(next) => set({ enamadWholesale: next })} />
        <EnamadEditor title="تکی — www.poshaktaranom.ir" value={biz.enamadRetail} onChange={(next) => set({ enamadRetail: next })} />
      </SettingsSection>
    </div>
  );
}

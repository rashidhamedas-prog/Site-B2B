'use client';

import { AdminChannelTabs } from '@/components/admin/AdminChannelTabs';
import { MediaAssetField, TextAreaField, TextField } from './fields';
import { SettingsSection } from './primitives';
import type { SaleChannel, SettingsPayload } from './types';

export function SeoTab({
  data,
  channel,
  onChannel,
  onChange,
}: {
  data: SettingsPayload;
  channel: SaleChannel;
  onChannel: (ch: SaleChannel) => void;
  onChange: (next: SettingsPayload) => void;
}) {
  const isRetail = channel === 'RETAIL';
  const seo = isRetail ? data.seo.retail : data.seo.wholesale;
  const setSeo = (patch: Partial<typeof seo>) => {
    onChange({
      ...data,
      seo: {
        ...data.seo,
        [isRetail ? 'retail' : 'wholesale']: { ...seo, ...patch },
      },
    });
  };
  const m = data.marketing;
  const setMarketing = (patch: Partial<SettingsPayload['marketing']>) =>
    onChange({ ...data, marketing: { ...m, ...patch } });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">عنوان، شرح و تصویر اشتراک برای همان سایتی که انتخاب کرده‌اید ذخیره می‌شود.</p>
        <AdminChannelTabs value={channel} onChange={onChannel} />
      </div>
      <SettingsSection
        tone={isRetail ? 'retail' : 'wholesale'}
        title={isRetail ? 'سئوی فروشگاه تکی' : 'سئوی سایت عمده'}
        badge={isRetail ? '.ir' : '.com'}
        hint="این‌ها پیش‌فرض layout هستند؛ صفحه محصول و مقاله عنوان خودشان را دارند. FAQ rich result دیگر نمایش داده نمی‌شود."
      >
        <TextField label="عنوان پیش‌فرض" value={seo.defaultTitle} onChange={(v) => setSeo({ defaultTitle: v })} />
        <TextAreaField label="شرح پیش‌فرض" value={seo.defaultDescription} onChange={(v) => setSeo({ defaultDescription: v })} rows={3} />
        <MediaAssetField
          label="تصویر Open Graph"
          url={seo.ogImageUrl}
          alt={seo.ogImageAlt}
          onUrl={(v) => setSeo({ ogImageUrl: v })}
          onAlt={(v) => setSeo({ ogImageAlt: v })}
          help="۱۲۰۰×۶۳۰ توصیه می‌شود. همین alt روی og:image:alt می‌رود."
        />
      </SettingsSection>
      <SettingsSection title="تأیید Search Console" hint="توکن گوگل از قبل در پیکسل‌ها هم هست؛ اینجا همان مقدار است تا از تنظیمات گم نشود.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="تأیید GSC عمده" value={m.gscWholesaleVerification} onChange={(v) => setMarketing({ gscWholesaleVerification: v })} dir="ltr" />
          <TextField label="تأیید GSC تکی" value={m.gscRetailVerification} onChange={(v) => setMarketing({ gscRetailVerification: v })} dir="ltr" />
        </div>
      </SettingsSection>
      <SettingsSection title="جست‌وجوی هوش مصنوعی" hint="کنترل crawler جدا از رتبه است. Google llms.txt را استفاده نمی‌کند؛ فایل ویژه AI نمی‌سازیم.">
        <p className="text-sm leading-7 text-gray-600">
          صفحات عمومی باید قابل خزش بمانند تا در Search و قابلیت‌های generative واجد شرایط باشند.
          Exclude جداگانه از Search Console است، نه از این فرم. آلت هر عکس محصول در کارت محصول تنظیم می‌شود، نه اینجا.
        </p>
      </SettingsSection>
    </div>
  );
}

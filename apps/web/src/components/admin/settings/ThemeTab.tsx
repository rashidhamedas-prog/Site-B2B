'use client';

import type { MutableRefObject } from 'react';
import { AdminChannelTabs } from '@/components/admin/AdminChannelTabs';
import { cn } from '@/lib/cn';
import { NumberField, TextAreaField, TextField, ToggleRow } from './fields';
import { SettingsSection } from './primitives';
import { HomeTickerCard } from './HomeTickerCard';
import type { SaleChannel, SettingsPayload } from './types';

export function ThemeTab({
  theme,
  channel,
  onChannel,
  onTheme,
  tickerSaveRef,
}: {
  theme: SettingsPayload['theme'];
  channel: SaleChannel;
  onChannel: (ch: SaleChannel) => void;
  onTheme: (next: SettingsPayload['theme']) => void;
  tickerSaveRef: MutableRefObject<() => Promise<void>>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">ظاهر ویترین</h3>
          <p className="mt-1 text-sm text-gray-500">
            قالب تکی، رنگ عمده، و نوار روان هوم برای هر سایت جدا تنظیم می‌شود.
          </p>
        </div>
        <AdminChannelTabs value={channel} onChange={onChannel} />
      </div>

      <HomeTickerCard channel={channel} saveRef={tickerSaveRef} />

      {channel === 'RETAIL' ? (
        <SettingsSection tone="retail" title="قالب ویترین تک‌فروشی" badge=".ir">
          <p className="text-xs text-gray-500">
            قالب فعلی تا وقتی «بوتیک» را ذخیره نکنید روی سایت زنده می‌ماند. تغییر تا حدود دو دقیقه روی هوم دیده می‌شود.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { id: 'classic' as const, title: 'کلاسیک ترنم', body: 'همان ویترین روشن فعلی؛ طلایی و کارگاهی.' },
              { id: 'boutique' as const, title: 'بوتیک', body: 'هدر تیره، جستجوی میانی، دو بنر و ریل محصول — با رنگ سبز ترنم.' },
            ]).map((opt) => {
              const active = (theme.retailStorefrontSkin ?? 'classic') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onTheme({ ...theme, retailStorefrontSkin: opt.id })}
                  className={cn(
                    'rounded-2xl border p-4 text-right transition-colors',
                    active ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-primary/40',
                  )}
                >
                  <span className="block text-sm font-bold text-gray-900">{opt.title}</span>
                  <span className="mt-1 block text-xs leading-6 text-gray-600">{opt.body}</span>
                </button>
              );
            })}
          </div>
        </SettingsSection>
      ) : (
        <>
          <SettingsSection tone="wholesale" title="رنگ‌های سایت عمده" badge=".com">
            <div className="grid grid-cols-2 gap-4">
              {([
                ['primaryColor', 'رنگ اصلی (Primary)'],
                ['secondaryColor', 'رنگ ثانویه (Secondary)'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme[key]}
                      onChange={(e) => onTheme({ ...theme, [key]: e.target.value })}
                      className="h-10 w-14 cursor-pointer rounded border border-gray-200"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={theme[key]}
                      onChange={(e) => onTheme({ ...theme, [key]: e.target.value })}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </SettingsSection>
          <SettingsSection title="حالت نمایش پس‌زمینه">
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'light', label: 'روشن' },
                { id: 'dark', label: 'تیره' },
                { id: 'customImage', label: 'تصویر سفارشی' },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onTheme({ ...theme, displayMode: m.id })}
                  className={cn(
                    'cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    theme.displayMode === m.id
                      ? 'border-primary bg-primary text-white'
                      : 'border-gray-200 text-gray-700 hover:border-primary/40',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {theme.displayMode === 'customImage' ? (
              <TextField
                label="آدرس تصویر پس‌زمینه"
                value={theme.backgroundImageUrl}
                onChange={(v) => onTheme({ ...theme, backgroundImageUrl: v })}
                dir="ltr"
              />
            ) : null}
          </SettingsSection>
          <SettingsSection title="شدت بلور شیشه‌ای">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={28}
                step={1}
                value={theme.glassBlurPx}
                onChange={(e) => onTheme({ ...theme, glassBlurPx: Number(e.target.value) })}
                className="flex-1 cursor-pointer accent-primary"
              />
              <span className="w-14 text-left font-mono text-sm text-gray-700" dir="ltr">{theme.glassBlurPx}px</span>
            </div>
          </SettingsSection>
          <SettingsSection title="پاپ‌آپ‌های لندینگ عمده">
            {(['boutique', 'newsletter'] as const).map((key) => {
              const popup = theme.popups[key];
              const label = key === 'boutique' ? 'پاپ‌آپ بوتیک‌دار' : 'پاپ‌آپ خبرنامه';
              return (
                <div key={key} className="space-y-3 rounded-2xl border border-gray-100 p-4">
                  <ToggleRow
                    label={label}
                    value={popup.enabled}
                    onChange={(v) => onTheme({
                      ...theme,
                      popups: { ...theme.popups, [key]: { ...theme.popups[key], enabled: v } },
                    })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">زمان نمایش</label>
                      <select
                        value={popup.trigger}
                        onChange={(e) => onTheme({
                          ...theme,
                          popups: { ...theme.popups, [key]: { ...theme.popups[key], trigger: e.target.value as 'delay' | 'exit' } },
                        })}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="delay">بعد از چند ثانیه</option>
                        <option value="exit">قصد خروج</option>
                      </select>
                    </div>
                    <NumberField
                      label="تأخیر (ثانیه)"
                      value={popup.delaySeconds}
                      onChange={(v) => onTheme({
                        ...theme,
                        popups: { ...theme.popups, [key]: { ...theme.popups[key], delaySeconds: Math.max(1, v) } },
                      })}
                    />
                  </div>
                  <TextField label="عنوان" value={popup.title} onChange={(v) => onTheme({ ...theme, popups: { ...theme.popups, [key]: { ...theme.popups[key], title: v } } })} />
                  <TextAreaField label="متن" value={popup.body} onChange={(v) => onTheme({ ...theme, popups: { ...theme.popups, [key]: { ...theme.popups[key], body: v } } })} />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="متن دکمه" value={popup.ctaLabel} onChange={(v) => onTheme({ ...theme, popups: { ...theme.popups, [key]: { ...theme.popups[key], ctaLabel: v } } })} />
                    <TextField label="لینک دکمه" value={popup.ctaUrl} onChange={(v) => onTheme({ ...theme, popups: { ...theme.popups, [key]: { ...theme.popups[key], ctaUrl: v } } })} dir="ltr" />
                  </div>
                </div>
              );
            })}
          </SettingsSection>
        </>
      )}
    </div>
  );
}

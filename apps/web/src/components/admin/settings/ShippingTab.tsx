'use client';

import { Plus, Trash2, Truck } from 'lucide-react';
import { AdminChannelTabs } from '@/components/admin/AdminChannelTabs';
import { NumberField, TextAreaField, TextField, ToggleRow } from './fields';
import { LiveStat, SettingsSection } from './primitives';
import type { SaleChannel, SettingsPayload, ShippingCompany, ShippingPostChannel } from './types';

function toman(rial: number) {
  return Math.round((rial || 0) / 10).toLocaleString('fa-IR');
}

function sampleRetailFee(retail: SettingsPayload['shipping']['retail']) {
  const base = Math.round((retail.baseFee ?? 0) / 10);
  const perKg = Math.round((retail.perKgFee ?? 0) / 10);
  const kg = Number(retail.kgPerPiece) > 0 ? Number(retail.kgPerPiece) : 0.45;
  const pieces = 2;
  const weightKg = Math.ceil(pieces * kg * 10) / 10;
  return { pieces, weightKg, fee: base + Math.ceil(weightKg) * perKg };
}

export function ShippingTab({
  shipping,
  shippingPost,
  channel,
  onChannel,
  onShipping,
  onPost,
}: {
  shipping: SettingsPayload['shipping'];
  shippingPost: SettingsPayload['shippingPost'];
  channel: SaleChannel;
  onChannel: (ch: SaleChannel) => void;
  onShipping: (next: SettingsPayload['shipping']) => void;
  onPost: (next: SettingsPayload['shippingPost']) => void;
}) {
  const isRetail = channel === 'RETAIL';
  const companies = isRetail ? shipping.retail.companies : shipping.wholesale.companies;
  const post = isRetail ? shippingPost.retail : shippingPost.wholesale;
  const preview = sampleRetailFee(shipping.retail);

  const setCompanies = (next: ShippingCompany[]) => {
    if (isRetail) {
      onShipping({ ...shipping, retail: { ...shipping.retail, companies: next } });
    } else {
      onShipping({ ...shipping, wholesale: { ...shipping.wholesale, companies: next }, companies: next });
    }
  };

  const setPost = (next: ShippingPostChannel) => {
    onPost({
      ...shippingPost,
      [isRetail ? 'retail' : 'wholesale']: next,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">روش‌های ارسال</h3>
          <p className="mt-1 text-sm text-gray-500">
            کارمزد، شرکت‌های حمل و محاسبه پیشتاز برای تکی و عمده جدا ذخیره می‌شود.
          </p>
        </div>
        <AdminChannelTabs value={channel} onChange={onChannel} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <LiveStat
          label={isRetail ? 'نمونه تکی (۲ عدد)' : 'هزینه ثابت عمده'}
          value={`${isRetail ? preview.fee.toLocaleString('fa-IR') : toman(shipping.wholesale.baseFee)} تومان`}
          hint={isRetail ? `وزن تقریبی ${preview.weightKg.toLocaleString('fa-IR')} کیلو` : 'بدون ضرب وزن'}
        />
        <LiveStat
          label="ارسال رایگان از"
          value={`${toman(isRetail ? shipping.retail.freeThreshold : shipping.wholesale.freeThreshold)} تومان`}
        />
        <LiveStat
          label="روش‌های فعال"
          value={String(companies.filter((c) => c.isActive !== false).length)}
          hint={`${companies.length} روش تعریف‌شده`}
        />
      </div>

      {isRetail ? (
        <SettingsSection
          tone="retail"
          title="کارمزد فروشگاه تکی"
          hint="فرمول وزن‌محور فقط روی poshaktaranom.ir اعمال می‌شود."
          badge=".ir"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              label="کارمزد پایه (تومان)"
              value={Math.round((shipping.retail.baseFee ?? 0) / 10)}
              onChange={(v) => onShipping({
                ...shipping,
                retail: { ...shipping.retail, baseFee: Math.max(0, v) * 10 },
                baseFee: Math.max(0, v) * 10,
              })}
            />
            <NumberField
              label="کارمزد هر کیلوگرم (تومان)"
              value={Math.round((shipping.retail.perKgFee ?? 0) / 10)}
              onChange={(v) => onShipping({
                ...shipping,
                retail: { ...shipping.retail, perKgFee: Math.max(0, v) * 10 },
                perKgFee: Math.max(0, v) * 10,
              })}
            />
            <NumberField
              label="وزن تقریبی هر عدد (کیلو)"
              value={Number(shipping.retail.kgPerPiece) > 0 ? Number(shipping.retail.kgPerPiece) : 0.45}
              step="0.01"
              min={0.05}
              onChange={(v) => {
                const kg = Math.max(0.05, Math.round(v * 100) / 100 || 0.45);
                onShipping({ ...shipping, retail: { ...shipping.retail, kgPerPiece: kg }, kgPerPiece: kg });
              }}
              help="پیش‌فرض ۰٫۴۵ کیلو — مانتو با بسته‌بندی"
            />
            <NumberField
              label="آستانه ارسال رایگان (تومان)"
              value={Math.round((shipping.retail.freeThreshold ?? 0) / 10)}
              onChange={(v) => onShipping({
                ...shipping,
                retail: { ...shipping.retail, freeThreshold: Math.max(0, v) * 10 },
                freeThreshold: Math.max(0, v) * 10,
              })}
            />
          </div>
          <TextAreaField
            label="توضیح محاسبه برای ادمین"
            value={shipping.retail.detailsText}
            onChange={(v) => onShipping({ ...shipping, retail: { ...shipping.retail, detailsText: v } })}
            rows={4}
          />
        </SettingsSection>
      ) : (
        <SettingsSection
          tone="wholesale"
          title="کارمزد سایت عمده"
          hint="هزینه ثابت است مگر اینکه مبلغ پس از تخفیف به آستانه رایگان برسد."
          badge=".com"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              label="هزینه ثابت ارسال (تومان)"
              value={Math.round((shipping.wholesale.baseFee ?? 0) / 10)}
              onChange={(v) => onShipping({
                ...shipping,
                wholesale: { ...shipping.wholesale, baseFee: Math.max(0, v) * 10 },
              })}
            />
            <NumberField
              label="آستانه ارسال رایگان (تومان)"
              value={Math.round((shipping.wholesale.freeThreshold ?? 0) / 10)}
              onChange={(v) => onShipping({
                ...shipping,
                wholesale: { ...shipping.wholesale, freeThreshold: Math.max(0, v) * 10 },
              })}
            />
          </div>
          <TextAreaField
            label="توضیح محاسبه برای ادمین"
            value={shipping.wholesale.detailsText}
            onChange={(v) => onShipping({ ...shipping, wholesale: { ...shipping.wholesale, detailsText: v } })}
            rows={4}
          />
        </SettingsSection>
      )}

      <SettingsSection
        tone={isRetail ? 'retail' : 'wholesale'}
        title="شرکت‌های حمل همین سایت"
        hint="فقط روش‌های فعال در چک‌اوت همین کانال دیده می‌شوند. تغییر تکی روی عمده اثر ندارد."
      >
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-outline btn-sm inline-flex items-center gap-1.5"
            onClick={() => setCompanies([
              ...companies,
              { id: `SHIP_${Date.now()}`, label: 'شرکت جدید', isActive: true, sort: companies.length * 10 + 10 },
            ])}
          >
            <Plus className="h-3.5 w-3.5" />
            افزودن روش
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {companies.map((c) => (
            <div key={c.id} className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-500">
                  <Truck className="h-4 w-4" />
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => setCompanies(companies.filter((x) => x.id !== c.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-3">
                <TextField label="نام روش" value={c.label} onChange={(v) => setCompanies(companies.map((x) => x.id === c.id ? { ...x, label: v } : x))} />
                <NumberField label="اولویت نمایش" value={c.sort} onChange={(v) => setCompanies(companies.map((x) => x.id === c.id ? { ...x, sort: v } : x))} />
                <ToggleRow label="فعال در چک‌اوت" value={c.isActive !== false} onChange={(v) => setCompanies(companies.map((x) => x.id === c.id ? { ...x, isActive: v } : x))} />
              </div>
            </div>
          ))}
        </div>
        {companies.length === 0 ? (
          <p className="text-sm text-gray-500">هنوز روشی برای این سایت تعریف نشده. یک روش اضافه کنید.</p>
        ) : null}
      </SettingsSection>

      <SettingsSection
        tone={isRetail ? 'retail' : 'wholesale'}
        title="محاسبه بسته پستی پیشتاز"
        hint="اگر روشن باشد، پست پیشتاز از استعلام آنلاین پست (و در قطعی، نرخ محلی) حساب می‌شود. بقیه روش‌ها همان کارمزد بالا را دارند."
        badge="پیشتاز"
      >
        <ToggleRow
          label="فعال‌سازی محاسبه دقیق پست"
          hint="فقط برای روش پست پیشتاز همین سایت"
          value={post.enabled}
          onChange={(v) => setPost({ ...post, enabled: v })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="استان مبدأ" value={post.originProvince} onChange={(v) => setPost({ ...post, originProvince: v })} />
          <TextField label="شهر مبدأ" value={post.originCity} onChange={(v) => setPost({ ...post, originCity: v })} />
          <NumberField label="پایه هم‌شهر (تومان)" value={Math.round(post.sameCityBase / 10)} onChange={(v) => setPost({ ...post, sameCityBase: Math.max(0, v) * 10 })} />
          <NumberField label="پایه هم‌استان (تومان)" value={Math.round(post.sameProvinceBase / 10)} onChange={(v) => setPost({ ...post, sameProvinceBase: Math.max(0, v) * 10 })} />
          <NumberField label="پایه سایر استان‌ها (تومان)" value={Math.round(post.otherBase / 10)} onChange={(v) => setPost({ ...post, otherBase: Math.max(0, v) * 10 })} />
          <NumberField label="هر کیلو مازاد (تومان)" value={Math.round(post.extraKgFee / 10)} onChange={(v) => setPost({ ...post, extraKgFee: Math.max(0, v) * 10 })} />
        </div>
      </SettingsSection>
    </div>
  );
}

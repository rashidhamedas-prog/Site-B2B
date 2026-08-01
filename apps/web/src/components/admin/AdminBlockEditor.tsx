'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, ImagePlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { BLOCK_TYPE_LABELS, newBlockId, type BlockType, type ContentBlock } from '@/lib/cms/types';

export type { BlockType, ContentBlock };
export { BLOCK_TYPE_LABELS, newBlockId };

const BLOCK_TYPES = Object.keys(BLOCK_TYPE_LABELS) as BlockType[];

const IMAGE_HINTS: Partial<Record<BlockType, string>> = {
  hero: 'ابعاد پیشنهادی: ۱۹۲۰×۸۰۰ پیکسل',
  image: 'ابعاد پیشنهادی: ۱۲۰۰×۸۰۰ پیکسل',
  gallery: 'ابعاد پیشنهادی: ۱۰۰۰×۱۰۰۰ پیکسل',
  chrome: 'لوگو: مربع ۱۲۸×۱۲۸ یا بزرگ‌تر',
};

export function createEmptyBlock(type: BlockType): ContentBlock {
  const base: Record<string, unknown> = {};
  switch (type) {
    case 'announcement':
      Object.assign(base, {
        enabled: true,
        text: '',
        phoneLabel: '',
        phoneHref: '',
        telegramLabel: '',
        telegramHref: '',
      });
      break;
    case 'chrome':
      Object.assign(base, {
        brandName: '',
        brandTagline: '',
        logoUrl: '',
        registerLabel: '',
        registerHref: '',
        portalHref: '',
        blurb: '',
        footerQuickTitle: 'دسترسی سریع',
        footerLegalTitle: 'اطلاعات حقوقی',
        footerContactTitle: 'اطلاعات تماس',
        phoneLabel: '',
        phoneHref: '',
        ownerLabel: '',
        addressTitle: '',
        addressLines: [''],
        telegramHref: '',
        instagramHref: '',
        copyright: '',
        madeInLabel: '',
        retailStoreLabel: '',
        retailStoreHref: '',
        floatPhone: '',
        floatWhatsapp: '',
        floatTelegram: '',
        floatWhatsappMessage: '',
      });
      break;
    case 'hero':
      Object.assign(base, {
        autoplayMs: 5500,
        slides: [
          {
            brandEyebrow: '',
            headline: '',
            headlineAccent: '',
            body: '',
            imageUrl: '',
            mobileImageUrl: '',
            imageAlt: '',
            presentation: 'overlay',
            ctaLabel: '',
            ctaHref: '',
            ctaSecondaryLabel: '',
            ctaSecondaryHref: '',
          },
        ],
      });
      break;
    case 'stats':
      Object.assign(base, { items: [{ value: '', label: '', sublabel: '' }] });
      break;
    case 'features':
      Object.assign(base, {
        eyebrow: '',
        headline: '',
        body: '',
        items: [{ icon: 'Package', title: '', description: '' }],
      });
      break;
    case 'process':
      Object.assign(base, {
        eyebrow: '',
        headline: '',
        body: '',
        steps: [{ step: '۰۱', title: '', description: '' }],
      });
      break;
    case 'testimonials':
      Object.assign(base, {
        eyebrow: '',
        headline: '',
        body: '',
        items: [{ name: '', business: '', city: '', rating: 5, text: '', avatar: '' }],
        footerStats: [{ value: '', label: '' }],
      });
      break;
    case 'faq':
      Object.assign(base, { headline: '', body: '', items: [{ question: '', answer: '' }] });
      break;
    case 'cta':
      Object.assign(base, {
        eyebrow: '',
        headline: '',
        body: '',
        ctaLabel: '',
        ctaHref: '',
        ctaSecondaryLabel: '',
        ctaSecondaryHref: '',
        ctaTertiaryLabel: '',
        ctaTertiaryHref: '',
      });
      break;
    case 'products':
      Object.assign(base, {
        eyebrow: '',
        headline: '',
        body: '',
        ctaLabel: '',
        ctaHref: '/products',
        viewAllLabel: '',
        productIds: '',
        limit: 12,
        sort: 'views',
      });
      break;
    case 'categoryBanners':
      Object.assign(base, {
        headline: 'دسته‌بندی‌ها',
        body: 'هر دسته یک کالکشن کامل است — با یک لمس وارد شوید',
        columns: 5,
        maxItems: 99,
        categoryIds: '',
      });
      break;
    case 'comingSoon':
      Object.assign(base, {
        eyebrow: '',
        headline: '',
        body: '',
        callout: '',
        ctaLabel: '',
        ctaHref: '/products',
      });
      break;
    case 'text':
      Object.assign(base, { headline: '', body: '' });
      break;
    case 'image':
      Object.assign(base, { imageUrl: '', body: '' });
      break;
    case 'gallery':
      Object.assign(base, { items: [{ imageUrl: '', body: '' }] });
      break;
    case 'html':
      Object.assign(base, { body: '' });
      break;
    case 'contact':
      Object.assign(base, {
        headline: '',
        channels: [{ icon: 'Phone', title: '', value: '', href: '' }],
        hours: [{ day: '', time: '' }],
        locations: [{ title: '', address: '', note: '' }],
      });
      break;
    case 'links':
      Object.assign(base, {
        headline: '',
        items: [{ label: '', href: '' }],
      });
      break;
  }
  return { id: newBlockId(), type, props: base };
}

function Field({
  label,
  value,
  onChange,
  multiline,
  dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-gray-500">{label}</label>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          dir={dir}
          onChange={(e) => onChange(e.target.value)}
          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      ) : (
        <input
          value={value}
          dir={dir}
          onChange={(e) => onChange(e.target.value)}
          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      )}
    </div>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="text-primary focus:ring-primary/30 h-4 w-4 rounded border-gray-300"
      />
      {label}
    </label>
  );
}

function ImageUrlField({
  label = 'آدرس تصویر',
  value,
  onChange,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const { upload, uploading } = useImageUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file?: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const url = await upload(file);
      onChange(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در آپلود');
    }
  };

  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-gray-500">{label}</label>
      <div className="flex gap-2">
        <input
          value={value}
          dir="ltr"
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… یا /logo.png"
          className="focus:ring-primary/30 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="btn btn-outline btn-sm flex shrink-0 cursor-pointer items-center gap-1"
          title="آپلود فایل"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          آپلود
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <p className="mt-1 text-[11px] text-gray-400">
        آپلود فایل یا آدرس کامل
        {hint ? ` — ${hint}` : ''}
      </p>
      {error && <p className="text-error mt-1 text-[11px]">{error}</p>}
      {value ? (
        <div className="mt-2 h-16 w-24 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}
    </div>
  );
}

function setProp(block: ContentBlock, key: string, value: unknown): ContentBlock {
  return { ...block, props: { ...block.props, [key]: value } };
}

function str(props: Record<string, unknown>, key: string) {
  return typeof props[key] === 'string' ? (props[key] as string) : '';
}

function ItemListEditor<T extends Record<string, unknown>>({
  items,
  onChange,
  blank,
  addLabel,
  renderItem,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  blank: T;
  addLabel: string;
  renderItem: (item: T, i: number, update: (patch: Partial<T>) => void) => ReactNode;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="relative space-y-2 rounded-lg bg-gray-50 p-3">
          <button
            type="button"
            className="hover:text-error absolute left-2 top-2 cursor-pointer text-gray-400"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            title="حذف"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {renderItem(item, i, (patch) => {
            const next = [...items];
            next[i] = { ...item, ...patch };
            onChange(next);
          })}
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm cursor-pointer"
        onClick={() => onChange([...items, { ...blank }])}
      >
        <Plus className="h-3 w-3" /> {addLabel}
      </button>
    </div>
  );
}

function BlockFields({
  block,
  onChange,
}: {
  block: ContentBlock;
  onChange: (b: ContentBlock) => void;
}) {
  const p = block.props;
  const set = (key: string, value: unknown) => onChange(setProp(block, key, value));

  if (block.type === 'announcement') {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <CheckField
            label="نمایش نوار اعلان"
            checked={p.enabled !== false}
            onChange={(v) => set('enabled', v)}
          />
        </div>
        <div className="sm:col-span-2">
          <Field label="متن اعلان (وسط)" value={str(p, 'text')} onChange={(v) => set('text', v)} />
        </div>
        <Field
          label="برچسب تلفن"
          value={str(p, 'phoneLabel')}
          onChange={(v) => set('phoneLabel', v)}
        />
        <Field
          label="لینک تلفن"
          value={str(p, 'phoneHref')}
          dir="ltr"
          onChange={(v) => set('phoneHref', v)}
        />
        <Field
          label="برچسب تلگرام"
          value={str(p, 'telegramLabel')}
          onChange={(v) => set('telegramLabel', v)}
        />
        <Field
          label="لینک تلگرام"
          value={str(p, 'telegramHref')}
          dir="ltr"
          onChange={(v) => set('telegramHref', v)}
        />
      </div>
    );
  }

  if (block.type === 'chrome') {
    const lines = Array.isArray(p.addressLines)
      ? (p.addressLines as string[])
      : [str(p, 'addressLine1'), str(p, 'addressLine2')].filter(Boolean);
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="نام برند" value={str(p, 'brandName')} onChange={(v) => set('brandName', v)} />
        <Field
          label="شعار زیر برند"
          value={str(p, 'brandTagline')}
          onChange={(v) => set('brandTagline', v)}
        />
        <div className="sm:col-span-2">
          <ImageUrlField
            label="لوگو"
            value={str(p, 'logoUrl')}
            hint={IMAGE_HINTS.chrome}
            onChange={(v) => set('logoUrl', v)}
          />
        </div>
        <Field
          label="متن دکمه ثبت‌نام"
          value={str(p, 'registerLabel')}
          onChange={(v) => set('registerLabel', v)}
        />
        <Field
          label="لینک ثبت‌نام"
          value={str(p, 'registerHref')}
          dir="ltr"
          onChange={(v) => set('registerHref', v)}
        />
        <Field
          label="لینک پنل"
          value={str(p, 'portalHref')}
          dir="ltr"
          onChange={(v) => set('portalHref', v)}
        />
        <div className="sm:col-span-2">
          <Field
            label="توضیح فوتر"
            multiline
            value={str(p, 'blurb')}
            onChange={(v) => set('blurb', v)}
          />
        </div>
        <Field
          label="عنوان ستون لینک‌ها"
          value={str(p, 'footerQuickTitle')}
          onChange={(v) => set('footerQuickTitle', v)}
        />
        <Field
          label="عنوان ستون حقوقی"
          value={str(p, 'footerLegalTitle')}
          onChange={(v) => set('footerLegalTitle', v)}
        />
        <Field
          label="عنوان ستون تماس"
          value={str(p, 'footerContactTitle')}
          onChange={(v) => set('footerContactTitle', v)}
        />
        <Field
          label="برچسب تلفن فوتر"
          value={str(p, 'phoneLabel')}
          onChange={(v) => set('phoneLabel', v)}
        />
        <Field
          label="لینک تلفن"
          value={str(p, 'phoneHref')}
          dir="ltr"
          onChange={(v) => set('phoneHref', v)}
        />
        <Field
          label="زیرعنوان تلفن (مدیر فروش)"
          value={str(p, 'ownerLabel')}
          onChange={(v) => set('ownerLabel', v)}
        />
        <Field
          label="عنوان آدرس"
          value={str(p, 'addressTitle')}
          onChange={(v) => set('addressTitle', v)}
        />
        <div className="sm:col-span-2">
          <Field
            label="خطوط آدرس (هر خط جدا)"
            multiline
            value={lines.join('\n')}
            onChange={(v) => set('addressLines', v.split('\n'))}
          />
        </div>
        <Field
          label="لینک تلگرام"
          value={str(p, 'telegramHref')}
          dir="ltr"
          onChange={(v) => set('telegramHref', v)}
        />
        <Field
          label="لینک اینستاگرام"
          value={str(p, 'instagramHref')}
          dir="ltr"
          onChange={(v) => set('instagramHref', v)}
        />
        <Field label="کپی‌رایت" value={str(p, 'copyright')} onChange={(v) => set('copyright', v)} />
        <Field
          label="متن ساخته‌شده در…"
          value={str(p, 'madeInLabel')}
          onChange={(v) => set('madeInLabel', v)}
        />
        <Field
          label="برچسب فروشگاه تکی"
          value={str(p, 'retailStoreLabel')}
          onChange={(v) => set('retailStoreLabel', v)}
        />
        <Field
          label="لینک فروشگاه تکی"
          value={str(p, 'retailStoreHref')}
          dir="ltr"
          onChange={(v) => set('retailStoreHref', v)}
        />
        <Field
          label="تلفن شناور"
          value={str(p, 'floatPhone')}
          dir="ltr"
          onChange={(v) => set('floatPhone', v)}
        />
        <Field
          label="واتس‌اپ (با کد کشور)"
          value={str(p, 'floatWhatsapp')}
          dir="ltr"
          onChange={(v) => set('floatWhatsapp', v)}
        />
        <Field
          label="یوزرنیم تلگرام شناور"
          value={str(p, 'floatTelegram')}
          dir="ltr"
          onChange={(v) => set('floatTelegram', v)}
        />
        <div className="sm:col-span-2">
          <Field
            label="پیام پیش‌فرض واتس‌اپ"
            value={str(p, 'floatWhatsappMessage')}
            onChange={(v) => set('floatWhatsappMessage', v)}
          />
        </div>
      </div>
    );
  }

  if (block.type === 'gallery') {
    const items = Array.isArray(p.items)
      ? (p.items as Array<{ imageUrl?: string; body?: string }>)
      : [];
    return (
      <ItemListEditor
        items={items}
        onChange={(next) => set('items', next)}
        blank={{ imageUrl: '', body: '' }}
        addLabel="افزودن تصویر"
        renderItem={(item, _i, update) => (
          <div className="grid gap-2 pr-6 sm:grid-cols-2">
            <ImageUrlField
              label="آدرس تصویر"
              value={item.imageUrl ?? ''}
              hint={IMAGE_HINTS.gallery}
              onChange={(v) => update({ imageUrl: v })}
            />
            <Field label="توضیح" value={item.body ?? ''} onChange={(v) => update({ body: v })} />
          </div>
        )}
      />
    );
  }

  if (block.type === 'faq') {
    const items = Array.isArray(p.items)
      ? (p.items as Array<{ question?: string; answer?: string }>)
      : [];
    return (
      <div className="space-y-3">
        <Field label="عنوان بخش" value={str(p, 'headline')} onChange={(v) => set('headline', v)} />
        <Field label="زیرعنوان" multiline value={str(p, 'body')} onChange={(v) => set('body', v)} />
        <ItemListEditor
          items={items}
          onChange={(next) => set('items', next)}
          blank={{ question: '', answer: '' }}
          addLabel="افزودن سوال"
          renderItem={(item, _i, update) => (
            <div className="space-y-2 pr-6">
              <Field
                label="سوال"
                value={item.question ?? ''}
                onChange={(v) => update({ question: v })}
              />
              <Field
                label="پاسخ"
                multiline
                value={item.answer ?? ''}
                onChange={(v) => update({ answer: v })}
              />
            </div>
          )}
        />
      </div>
    );
  }

  if (block.type === 'stats') {
    const items = Array.isArray(p.items)
      ? (p.items as Array<{ value?: string; label?: string; sublabel?: string }>)
      : [];
    return (
      <ItemListEditor
        items={items}
        onChange={(next) => set('items', next)}
        blank={{ value: '', label: '', sublabel: '' }}
        addLabel="افزودن آمار"
        renderItem={(item, _i, update) => (
          <div className="grid gap-2 pr-6 sm:grid-cols-3">
            <Field label="عدد" value={item.value ?? ''} onChange={(v) => update({ value: v })} />
            <Field label="برچسب" value={item.label ?? ''} onChange={(v) => update({ label: v })} />
            <Field
              label="زیربرچسب"
              value={item.sublabel ?? ''}
              onChange={(v) => update({ sublabel: v })}
            />
          </div>
        )}
      />
    );
  }

  if (block.type === 'features') {
    const items = Array.isArray(p.items)
      ? (p.items as Array<{ icon?: string; title?: string; description?: string }>)
      : [];
    return (
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="ابرو" value={str(p, 'eyebrow')} onChange={(v) => set('eyebrow', v)} />
          <Field label="عنوان" value={str(p, 'headline')} onChange={(v) => set('headline', v)} />
        </div>
        <Field label="توضیح" multiline value={str(p, 'body')} onChange={(v) => set('body', v)} />
        <ItemListEditor
          items={items}
          onChange={(next) => set('items', next)}
          blank={{ icon: 'Package', title: '', description: '' }}
          addLabel="افزودن ویژگی"
          renderItem={(item, _i, update) => (
            <div className="space-y-2 pr-6">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field
                  label="آیکون (Package, Shield, Truck, …)"
                  value={item.icon ?? ''}
                  dir="ltr"
                  onChange={(v) => update({ icon: v })}
                />
                <Field
                  label="عنوان"
                  value={item.title ?? ''}
                  onChange={(v) => update({ title: v })}
                />
              </div>
              <Field
                label="توضیح"
                multiline
                value={item.description ?? ''}
                onChange={(v) => update({ description: v })}
              />
            </div>
          )}
        />
      </div>
    );
  }

  if (block.type === 'process') {
    const steps = Array.isArray(p.steps)
      ? (p.steps as Array<{ step?: string; title?: string; description?: string }>)
      : [];
    return (
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="ابرو" value={str(p, 'eyebrow')} onChange={(v) => set('eyebrow', v)} />
          <Field label="عنوان" value={str(p, 'headline')} onChange={(v) => set('headline', v)} />
        </div>
        <Field label="توضیح" multiline value={str(p, 'body')} onChange={(v) => set('body', v)} />
        <ItemListEditor
          items={steps}
          onChange={(next) => set('steps', next)}
          blank={{ step: '', title: '', description: '' }}
          addLabel="افزودن مرحله"
          renderItem={(item, _i, update) => (
            <div className="space-y-2 pr-6">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field
                  label="شماره مرحله"
                  value={item.step ?? ''}
                  onChange={(v) => update({ step: v })}
                />
                <Field
                  label="عنوان"
                  value={item.title ?? ''}
                  onChange={(v) => update({ title: v })}
                />
              </div>
              <Field
                label="توضیح"
                multiline
                value={item.description ?? ''}
                onChange={(v) => update({ description: v })}
              />
            </div>
          )}
        />
      </div>
    );
  }

  if (block.type === 'testimonials') {
    const items = Array.isArray(p.items)
      ? (p.items as Array<{
          name?: string;
          business?: string;
          city?: string;
          rating?: number;
          text?: string;
          avatar?: string;
        }>)
      : [];
    const footerStats = Array.isArray(p.footerStats)
      ? (p.footerStats as Array<{ value?: string; label?: string }>)
      : [];
    return (
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="ابرو" value={str(p, 'eyebrow')} onChange={(v) => set('eyebrow', v)} />
          <Field label="عنوان" value={str(p, 'headline')} onChange={(v) => set('headline', v)} />
        </div>
        <Field label="توضیح" multiline value={str(p, 'body')} onChange={(v) => set('body', v)} />
        <p className="text-xs font-semibold text-gray-600">نظرات</p>
        <ItemListEditor
          items={items}
          onChange={(next) => set('items', next)}
          blank={{ name: '', business: '', city: '', rating: 5, text: '', avatar: '' }}
          addLabel="افزودن نظر"
          renderItem={(item, _i, update) => (
            <div className="space-y-2 pr-6">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="نام" value={item.name ?? ''} onChange={(v) => update({ name: v })} />
                <Field
                  label="حرف آواتار"
                  value={item.avatar ?? ''}
                  onChange={(v) => update({ avatar: v })}
                />
                <Field
                  label="بوتیک / کسب‌وکار"
                  value={item.business ?? ''}
                  onChange={(v) => update({ business: v })}
                />
                <Field label="شهر" value={item.city ?? ''} onChange={(v) => update({ city: v })} />
                <Field
                  label="امتیاز (۱–۵)"
                  value={String(item.rating ?? 5)}
                  dir="ltr"
                  onChange={(v) => update({ rating: Math.min(5, Math.max(1, Number(v) || 5)) })}
                />
              </div>
              <Field
                label="متن نظر"
                multiline
                value={item.text ?? ''}
                onChange={(v) => update({ text: v })}
              />
            </div>
          )}
        />
        <p className="text-xs font-semibold text-gray-600">آمار پایین بخش</p>
        <ItemListEditor
          items={footerStats}
          onChange={(next) => set('footerStats', next)}
          blank={{ value: '', label: '' }}
          addLabel="افزودن آمار"
          renderItem={(item, _i, update) => (
            <div className="grid gap-2 pr-6 sm:grid-cols-2">
              <Field label="عدد" value={item.value ?? ''} onChange={(v) => update({ value: v })} />
              <Field
                label="برچسب"
                value={item.label ?? ''}
                onChange={(v) => update({ label: v })}
              />
            </div>
          )}
        />
      </div>
    );
  }

  if (block.type === 'contact') {
    const channels = Array.isArray(p.channels)
      ? (p.channels as Array<{ icon?: string; title?: string; value?: string; href?: string }>)
      : [];
    const hours = Array.isArray(p.hours) ? (p.hours as Array<{ day?: string; time?: string }>) : [];
    const locations = Array.isArray(p.locations)
      ? (p.locations as Array<{ title?: string; address?: string; note?: string }>)
      : [];
    return (
      <div className="space-y-3">
        <Field label="عنوان بخش" value={str(p, 'headline')} onChange={(v) => set('headline', v)} />
        <p className="text-xs font-semibold text-gray-600">کانال‌های تماس</p>
        <ItemListEditor
          items={channels}
          onChange={(next) => set('channels', next)}
          blank={{ icon: 'Phone', title: '', value: '', href: '' }}
          addLabel="افزودن کانال"
          renderItem={(item, _i, update) => (
            <div className="grid gap-2 pr-6 sm:grid-cols-2">
              <Field
                label="آیکون"
                value={item.icon ?? ''}
                dir="ltr"
                onChange={(v) => update({ icon: v })}
              />
              <Field
                label="عنوان"
                value={item.title ?? ''}
                onChange={(v) => update({ title: v })}
              />
              <Field
                label="مقدار"
                value={item.value ?? ''}
                onChange={(v) => update({ value: v })}
              />
              <Field
                label="لینک"
                value={item.href ?? ''}
                dir="ltr"
                onChange={(v) => update({ href: v })}
              />
            </div>
          )}
        />
        <p className="text-xs font-semibold text-gray-600">ساعات کاری</p>
        <ItemListEditor
          items={hours}
          onChange={(next) => set('hours', next)}
          blank={{ day: '', time: '' }}
          addLabel="افزودن ساعت"
          renderItem={(item, _i, update) => (
            <div className="grid gap-2 pr-6 sm:grid-cols-2">
              <Field label="روز" value={item.day ?? ''} onChange={(v) => update({ day: v })} />
              <Field label="ساعت" value={item.time ?? ''} onChange={(v) => update({ time: v })} />
            </div>
          )}
        />
        <p className="text-xs font-semibold text-gray-600">آدرس‌ها</p>
        <ItemListEditor
          items={locations}
          onChange={(next) => set('locations', next)}
          blank={{ title: '', address: '', note: '' }}
          addLabel="افزودن آدرس"
          renderItem={(item, _i, update) => (
            <div className="space-y-2 pr-6">
              <Field
                label="عنوان"
                value={item.title ?? ''}
                onChange={(v) => update({ title: v })}
              />
              <Field
                label="آدرس"
                multiline
                value={item.address ?? ''}
                onChange={(v) => update({ address: v })}
              />
              <Field
                label="یادداشت"
                value={item.note ?? ''}
                onChange={(v) => update({ note: v })}
              />
            </div>
          )}
        />
      </div>
    );
  }

  if (block.type === 'links') {
    const items = Array.isArray(p.items)
      ? (p.items as Array<{ label?: string; href?: string }>)
      : [];
    return (
      <div className="space-y-3">
        <Field label="عنوان" value={str(p, 'headline')} onChange={(v) => set('headline', v)} />
        <ItemListEditor
          items={items}
          onChange={(next) => set('items', next)}
          blank={{ label: '', href: '' }}
          addLabel="افزودن لینک"
          renderItem={(item, _i, update) => (
            <div className="grid gap-2 pr-6 sm:grid-cols-2">
              <Field
                label="برچسب"
                value={item.label ?? ''}
                onChange={(v) => update({ label: v })}
              />
              <Field
                label="لینک"
                value={item.href ?? ''}
                dir="ltr"
                onChange={(v) => update({ href: v })}
              />
            </div>
          )}
        />
      </div>
    );
  }

  if (block.type === 'hero') {
    type HeroSlideEdit = {
      brandEyebrow?: string;
      headline?: string;
      headlineAccent?: string;
      body?: string;
      imageUrl?: string;
      mobileImageUrl?: string;
      imageAlt?: string;
      presentation?: 'overlay' | 'artwork';
      ctaLabel?: string;
      ctaHref?: string;
      ctaSecondaryLabel?: string;
      ctaSecondaryHref?: string;
    };

    const blankSlide: HeroSlideEdit = {
      brandEyebrow: '',
      headline: '',
      headlineAccent: '',
      body: '',
      imageUrl: '',
      mobileImageUrl: '',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: '',
      ctaHref: '',
      ctaSecondaryLabel: '',
      ctaSecondaryHref: '',
    };

    const slidesFromProps: HeroSlideEdit[] = Array.isArray(p.slides)
      ? (p.slides as HeroSlideEdit[])
      : [];

    const legacyFlat: HeroSlideEdit | null =
      typeof p.headline === 'string' && p.headline.trim()
        ? {
            brandEyebrow: str(p, 'brandEyebrow'),
            headline: str(p, 'headline'),
            headlineAccent: str(p, 'headlineAccent'),
            body: str(p, 'body'),
            imageUrl: str(p, 'imageUrl'),
            mobileImageUrl: str(p, 'mobileImageUrl'),
            imageAlt: str(p, 'imageAlt'),
            presentation: str(p, 'presentation') === 'artwork' ? 'artwork' : 'overlay',
            ctaLabel: str(p, 'ctaLabel'),
            ctaHref: str(p, 'ctaHref'),
            ctaSecondaryLabel: str(p, 'ctaSecondaryLabel'),
            ctaSecondaryHref: str(p, 'ctaSecondaryHref'),
          }
        : null;

    const slides =
      slidesFromProps.length > 0 ? slidesFromProps : legacyFlat ? [legacyFlat] : [blankSlide];

    return (
      <div className="space-y-3">
        <Field
          label="فاصله تعویض خودکار (میلی‌ثانیه — ۰ = خاموش)"
          value={String(typeof p.autoplayMs === 'number' ? p.autoplayMs : 5500)}
          dir="ltr"
          onChange={(v) => set('autoplayMs', Math.max(0, Number(v) || 0))}
        />
        <p className="text-[11px] text-gray-400">
          حالت «متن روی تصویر» برای تصاویر خام؛ حالت «بنر کامل» برای artwork دارای متن داخلی است.
        </p>
        <ItemListEditor
          items={slides}
          onChange={(next) => {
            onChange({
              ...block,
              props: {
                autoplayMs: typeof p.autoplayMs === 'number' ? p.autoplayMs : 5500,
                slides: next,
              },
            });
          }}
          blank={blankSlide}
          addLabel="افزودن اسلاید"
          renderItem={(item, i, update) => (
            <div className="grid gap-2 pr-6 sm:grid-cols-2">
              <div className="text-[11px] font-semibold text-gray-500 sm:col-span-2">
                اسلاید {i + 1}
              </div>
              <Field
                label="ابرو / برچسب بالا"
                value={item.brandEyebrow ?? ''}
                onChange={(v) => update({ brandEyebrow: v })}
              />
              <Field
                label="قسمت رنگی عنوان"
                value={item.headlineAccent ?? ''}
                onChange={(v) => update({ headlineAccent: v })}
              />
              <div className="sm:col-span-2">
                <Field
                  label="عنوان (خط جدید با Enter)"
                  value={item.headline ?? ''}
                  multiline
                  onChange={(v) => update({ headline: v })}
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="توضیح"
                  value={item.body ?? ''}
                  multiline
                  onChange={(v) => update({ body: v })}
                />
              </div>
              <div className="sm:col-span-2">
                <ImageUrlField
                  label="تصویر اسلاید"
                  value={item.imageUrl ?? ''}
                  hint={IMAGE_HINTS.hero}
                  onChange={(v) => update({ imageUrl: v })}
                />
              </div>
              <div className="sm:col-span-2">
                <ImageUrlField
                  label="تصویر موبایل اسلاید (اختیاری)"
                  value={item.mobileImageUrl ?? ''}
                  hint="نسخه عمودی پیشنهادی: ۱۰۸۰×۱۳۵۰ پیکسل"
                  onChange={(v) => update({ mobileImageUrl: v })}
                />
              </div>
              <Field
                label="متن جایگزین تصویر"
                value={item.imageAlt ?? ''}
                onChange={(v) => update({ imageAlt: v })}
              />
              <label className="space-y-1 text-xs font-medium text-gray-600">
                <span>نوع نمایش اسلاید</span>
                <select
                  value={item.presentation ?? 'overlay'}
                  onChange={(e) =>
                    update({ presentation: e.target.value as 'overlay' | 'artwork' })
                  }
                  className="focus:border-primary w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
                >
                  <option value="overlay">متن HTML روی تصویر</option>
                  <option value="artwork">بنر کامل دارای متن داخلی</option>
                </select>
              </label>
              <Field
                label="متن دکمه اصلی"
                value={item.ctaLabel ?? ''}
                onChange={(v) => update({ ctaLabel: v })}
              />
              <Field
                label="لینک دکمه اصلی"
                value={item.ctaHref ?? ''}
                dir="ltr"
                onChange={(v) => update({ ctaHref: v })}
              />
              <Field
                label="متن دکمه دوم"
                value={item.ctaSecondaryLabel ?? ''}
                onChange={(v) => update({ ctaSecondaryLabel: v })}
              />
              <Field
                label="لینک دکمه دوم"
                value={item.ctaSecondaryHref ?? ''}
                dir="ltr"
                onChange={(v) => update({ ctaSecondaryHref: v })}
              />
            </div>
          )}
        />
      </div>
    );
  }

  // text, image, cta, products, comingSoon, html
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {['cta', 'products', 'comingSoon'].includes(block.type) && (
        <Field
          label="ابرو / برچسب بالا"
          value={str(p, 'eyebrow')}
          onChange={(v) => set('eyebrow', v)}
        />
      )}
      {['text', 'cta', 'products', 'categoryBanners', 'comingSoon'].includes(block.type) && (
        <Field label="عنوان" value={str(p, 'headline')} onChange={(v) => set('headline', v)} />
      )}
      {block.type === 'image' && (
        <div className="sm:col-span-2">
          <ImageUrlField
            label="آدرس تصویر"
            value={str(p, 'imageUrl')}
            hint={IMAGE_HINTS[block.type]}
            onChange={(v) => set('imageUrl', v)}
          />
        </div>
      )}
      {['cta', 'products', 'comingSoon'].includes(block.type) && (
        <>
          <Field
            label="متن دکمه اصلی"
            value={str(p, 'ctaLabel')}
            onChange={(v) => set('ctaLabel', v)}
          />
          <Field
            label="لینک دکمه اصلی"
            value={str(p, 'ctaHref')}
            dir="ltr"
            onChange={(v) => set('ctaHref', v)}
          />
        </>
      )}
      {block.type === 'cta' && (
        <>
          <Field
            label="متن دکمه دوم"
            value={str(p, 'ctaSecondaryLabel')}
            onChange={(v) => set('ctaSecondaryLabel', v)}
          />
          <Field
            label="لینک دکمه دوم"
            value={str(p, 'ctaSecondaryHref')}
            dir="ltr"
            onChange={(v) => set('ctaSecondaryHref', v)}
          />
          <Field
            label="متن دکمه سوم"
            value={str(p, 'ctaTertiaryLabel')}
            onChange={(v) => set('ctaTertiaryLabel', v)}
          />
          <Field
            label="لینک دکمه سوم"
            value={str(p, 'ctaTertiaryHref')}
            dir="ltr"
            onChange={(v) => set('ctaTertiaryHref', v)}
          />
        </>
      )}
      {block.type === 'products' && (
        <>
          <Field
            label="شناسه محصولات (اختیاری، با کاما)"
            value={str(p, 'productIds')}
            dir="ltr"
            onChange={(v) => set('productIds', v)}
          />
          <Field
            label="متن دکمه مشاهده همه"
            value={str(p, 'viewAllLabel')}
            onChange={(v) => set('viewAllLabel', v)}
          />
          <Field
            label="تعداد نمایش"
            value={String(typeof p.limit === 'number' ? p.limit : 12)}
            dir="ltr"
            onChange={(v) => set('limit', Math.max(1, Number(v) || 12))}
          />
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">مرتب‌سازی</label>
            <select
              value={str(p, 'sort') || 'views'}
              onChange={(e) => set('sort', e.target.value)}
              className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            >
              <option value="views">پربازدیدترین</option>
              <option value="newest">جدیدترین</option>
              <option value="discounted">تخفیف‌دار + جدید</option>
            </select>
          </div>
        </>
      )}
      {block.type === 'categoryBanners' && (
        <>
          <Field
            label="تعداد ستون (۲ تا ۵)"
            value={String(typeof p.columns === 'number' ? p.columns : 5)}
            dir="ltr"
            onChange={(v) => set('columns', Math.min(5, Math.max(2, Number(v) || 5)))}
          />
          <Field
            label="حداکثر بنر (۹۹ = همه)"
            value={String(typeof p.maxItems === 'number' ? p.maxItems : 99)}
            dir="ltr"
            onChange={(v) => set('maxItems', Math.max(1, Number(v) || 99))}
          />
          <Field
            label="شناسه دسته‌ها (اختیاری، با کاما — خالی = همه)"
            value={str(p, 'categoryIds')}
            dir="ltr"
            onChange={(v) => set('categoryIds', v)}
          />
        </>
      )}
      {block.type === 'comingSoon' && (
        <div className="sm:col-span-2">
          <Field label="کال‌اوت" value={str(p, 'callout')} onChange={(v) => set('callout', v)} />
        </div>
      )}
      {(block.type === 'html' ||
        block.type === 'text' ||
        block.type === 'cta' ||
        block.type === 'products' ||
        block.type === 'categoryBanners' ||
        block.type === 'comingSoon' ||
        block.type === 'image') && (
        <div className="sm:col-span-2">
          <Field
            label={
              block.type === 'html' ? 'کد HTML' : block.type === 'image' ? 'توضیح تصویر' : 'متن'
            }
            multiline
            value={str(p, 'body')}
            dir={block.type === 'html' ? 'ltr' : undefined}
            onChange={(v) => set('body', v)}
          />
        </div>
      )}
    </div>
  );
}

interface AdminBlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  className?: string;
}

export function AdminBlockEditor({ blocks, onChange, className }: AdminBlockEditorProps) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const updateAt = (index: number, block: ContentBlock) => {
    const next = [...blocks];
    next[index] = block;
    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800">بلوک‌های محتوا</p>
        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
          {BLOCK_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange([...blocks, createEmptyBlock(type)])}
              className="hover:border-primary hover:text-primary cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600"
            >
              <Plus className="mr-0.5 inline h-3 w-3" />
              {BLOCK_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {blocks.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          بلوکی اضافه نشده — از دکمه‌های بالا یک نوع انتخاب کنید یا «بارگذاری پیش‌فرض» را بزنید
        </p>
      )}

      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-xl border border-gray-100 bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="bg-primary/10 text-primary rounded-lg px-2.5 py-1 text-xs font-bold">
              {BLOCK_TYPE_LABELS[block.type] ?? block.type}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                onClick={() => move(index, index - 1)}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                onClick={() => move(index, index + 1)}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="hover:text-error cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-red-50"
                onClick={() => removeAt(index)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <BlockFields block={block} onChange={(b) => updateAt(index, b)} />
        </div>
      ))}
    </div>
  );
}

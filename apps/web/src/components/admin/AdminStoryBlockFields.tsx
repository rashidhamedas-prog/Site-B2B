'use client';

import type { ContentBlock } from '@/lib/cms/types';
import { storyboardImageSrc } from '@/lib/sales-partner-public-facts';

function Field({
  label,
  value,
  onChange,
  multiline,
  dir,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  dir?: 'ltr' | 'rtl';
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-gray-500">{label}</label>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          dir={dir}
          onChange={(event) => onChange(event.target.value)}
          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      ) : (
        <input
          value={value}
          dir={dir}
          onChange={(event) => onChange(event.target.value)}
          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      )}
      {hint ? <p className="mt-1 text-[11px] leading-5 text-gray-400">{hint}</p> : null}
    </div>
  );
}

function str(props: Record<string, unknown>, key: string) {
  return typeof props[key] === 'string' ? (props[key] as string) : '';
}

const FILE_HINT =
  'از عرض ۷۶۸ پیکسل تصویر دسکتاپ بدون متن است و عنوان و توضیح زیر تصویر نوشته می‌شود. موبایل همان کارت متن‌دار است. فایل را با پسوند نسخه عوض کنید: scene-0N-desktop-v2b.webp (۱۲۸۰×۷۲۰، بدون متن) و scene-0N-mobile-v2a.webp (۱۰۸۰×۱۳۵۰، با متن).';

export function AdminStoryBlockFields({
  block,
  onChange,
}: {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
}) {
  const props = block.props;
  const set = (key: string, value: unknown) => onChange({ ...block, props: { ...props, [key]: value } });

  if (block.type === 'storyboard') {
    const steps = Array.isArray(props.steps) ? (props.steps as Array<Record<string, unknown>>) : [];
    return (
      <div className="space-y-3">
        <p className="text-[11px] leading-5 text-gray-500">{FILE_HINT}</p>
        <Field label="عنوان بخش" value={str(props, 'headline')} onChange={(value) => set('headline', value)} />
        <Field label="معرفی" multiline value={str(props, 'body')} onChange={(value) => set('body', value)} />
        {steps.map((step, index) => {
          const aside =
            step.aside && typeof step.aside === 'object' ? (step.aside as Record<string, unknown>) : {};
          const update = (patch: Record<string, unknown>) => {
            const next = [...steps];
            next[index] = { ...step, ...patch };
            set('steps', next);
          };
          const n = typeof step.n === 'number' ? step.n : index + 1;
          return (
            <div key={n} className="space-y-2 rounded-lg bg-gray-50 p-3">
              <Field label="عنوان قدم" value={typeof step.title === 'string' ? step.title : ''} onChange={(value) => update({ title: value })} />
              <Field
                label="متن کارت (alt)"
                multiline
                value={typeof step.body === 'string' ? step.body : ''}
                onChange={(value) => update({ body: value })}
              />
              <Field
                label="عنوان راه دوم"
                value={typeof aside.title === 'string' ? aside.title : ''}
                onChange={(value) => update({ aside: { ...aside, title: value } })}
              />
              <Field
                label="متن راه دوم"
                multiline
                value={typeof aside.body === 'string' ? aside.body : ''}
                onChange={(value) => update({ aside: { ...aside, body: value } })}
              />
              <Field
                label="تصویر دسکتاپ"
                dir="ltr"
                value={typeof step.image === 'string' ? step.image : storyboardImageSrc(n).desktop}
                onChange={(value) => update({ image: value })}
              />
              <Field
                label="تصویر موبایل"
                dir="ltr"
                value={typeof step.imageMobile === 'string' ? step.imageMobile : storyboardImageSrc(n).mobile}
                onChange={(value) => update({ imageMobile: value })}
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (block.type === 'moneyTimeline') {
    const stages = Array.isArray(props.stages) ? (props.stages as Array<Record<string, unknown>>) : [];
    return (
      <div className="space-y-3">
        <Field label="عنوان" value={str(props, 'headline')} onChange={(value) => set('headline', value)} />
        {stages.map((stage, index) => (
          <div key={index} className="space-y-2 rounded-lg bg-gray-50 p-3">
            <Field
              label="مرحله"
              value={typeof stage.title === 'string' ? stage.title : ''}
              onChange={(value) => {
                const next = [...stages];
                next[index] = { ...stage, title: value };
                set('stages', next);
              }}
            />
            <Field
              label="توضیح"
              multiline
              value={typeof stage.body === 'string' ? stage.body : ''}
              onChange={(value) => {
                const next = [...stages];
                next[index] = { ...stage, body: value };
                set('stages', next);
              }}
            />
          </div>
        ))}
        <Field label="زیرنویس" multiline value={str(props, 'note')} onChange={(value) => set('note', value)} />
      </div>
    );
  }

  if (block.type === 'earningExample') {
    const items = Array.isArray(props.items) ? (props.items as Array<Record<string, unknown>>) : [];
    return (
      <div className="space-y-3">
        <Field label="برچسب" value={str(props, 'badge')} onChange={(value) => set('badge', value)} />
        <Field label="داستان" multiline value={str(props, 'story')} onChange={(value) => set('story', value)} />
        {items.map((item, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-2">
            <Field
              label="کالا"
              value={typeof item.label === 'string' ? item.label : ''}
              onChange={(value) => {
                const next = [...items];
                next[index] = { ...item, label: value };
                set('items', next);
              }}
            />
            <Field
              label="قیمت (تومان)"
              dir="ltr"
              value={item.priceToman == null ? '' : String(item.priceToman)}
              onChange={(value) => {
                const next = [...items];
                next[index] = { ...item, priceToman: Number(value.replace(/[^\d]/g, '')) || 0 };
                set('items', next);
              }}
            />
          </div>
        ))}
        <Field
          label="درصد تخفیف"
          dir="ltr"
          value={props.discountPercent == null ? '' : String(props.discountPercent)}
          onChange={(value) => set('discountPercent', Number(value.replace(/[^\d]/g, '')) || 0)}
        />
        <Field
          label="درصد پورسانت"
          dir="ltr"
          value={props.commissionPercent == null ? '' : String(props.commissionPercent)}
          onChange={(value) => set('commissionPercent', Number(value.replace(/[^\d]/g, '')) || 0)}
        />
        <Field label="جمع‌بندی تکرار" multiline value={str(props, 'repeatNote')} onChange={(value) => set('repeatNote', value)} hint="جای {repeat} و {min} با عدد محاسبه‌شده پر می‌شود." />
        <Field label="پانویس" multiline value={str(props, 'disclaimer')} onChange={(value) => set('disclaimer', value)} />
      </div>
    );
  }

  const you = Array.isArray(props.you) ? (props.you as string[]).join('\n') : '';
  const taranom = Array.isArray(props.taranom) ? (props.taranom as string[]).join('\n') : '';
  return (
    <div className="space-y-3">
      <Field label="عنوان" value={str(props, 'headline')} onChange={(value) => set('headline', value)} />
      <Field
        label="کار شما (هر خط یک مورد)"
        multiline
        value={you}
        onChange={(value) => set('you', value.split('\n'))}
      />
      <Field
        label="کار ترنم (هر خط یک مورد)"
        multiline
        value={taranom}
        onChange={(value) => set('taranom', value.split('\n'))}
      />
    </div>
  );
}

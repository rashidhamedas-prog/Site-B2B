'use client';

import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export type BlockType =
  | 'hero'
  | 'text'
  | 'image'
  | 'gallery'
  | 'faq'
  | 'cta'
  | 'html'
  | 'products';

export interface ContentBlock {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  hero: 'هیرو',
  text: 'متن',
  image: 'تصویر',
  gallery: 'گالری',
  faq: 'سوالات متداول',
  cta: 'دعوت به اقدام',
  html: 'HTML',
  products: 'محصولات',
};

const BLOCK_TYPES = Object.keys(BLOCK_TYPE_LABELS) as BlockType[];

export function newBlockId() {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyBlock(type: BlockType): ContentBlock {
  const base: Record<string, unknown> = {};
  switch (type) {
    case 'hero':
      Object.assign(base, { headline: '', body: '', imageUrl: '', ctaLabel: '', ctaHref: '' });
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
    case 'faq':
      Object.assign(base, { headline: '', items: [{ question: '', answer: '' }] });
      break;
    case 'cta':
      Object.assign(base, { headline: '', body: '', ctaLabel: '', ctaHref: '' });
      break;
    case 'html':
      Object.assign(base, { body: '' });
      break;
    case 'products':
      Object.assign(base, { headline: '', body: '', productIds: '' });
      break;
  }
  return { id: newBlockId(), type, props: base };
}

function Field({
  label, value, onChange, multiline, dir,
}: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; dir?: 'ltr' | 'rtl';
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
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      ) : (
        <input
          value={value}
          dir={dir}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}
    </div>
  );
}

function setProp(block: ContentBlock, key: string, value: unknown): ContentBlock {
  return { ...block, props: { ...block.props, [key]: value } };
}

function str(props: Record<string, unknown>, key: string) {
  return typeof props[key] === 'string' ? (props[key] as string) : '';
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

  if (block.type === 'gallery') {
    const items = Array.isArray(p.items) ? (p.items as Array<{ imageUrl?: string; body?: string }>) : [];
    return (
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-2">
            <Field
              label="آدرس تصویر"
              value={item.imageUrl ?? ''}
              dir="ltr"
              onChange={(v) => {
                const next = [...items];
                next[i] = { ...item, imageUrl: v };
                set('items', next);
              }}
            />
            <div className="flex gap-1">
              <div className="flex-1">
                <Field
                  label="توضیح"
                  value={item.body ?? ''}
                  onChange={(v) => {
                    const next = [...items];
                    next[i] = { ...item, body: v };
                    set('items', next);
                  }}
                />
              </div>
              <button
                type="button"
                className="mt-5 cursor-pointer text-gray-400 hover:text-error"
                onClick={() => set('items', items.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm cursor-pointer"
          onClick={() => set('items', [...items, { imageUrl: '', body: '' }])}
        >
          <Plus className="h-3 w-3" /> افزودن تصویر
        </button>
      </div>
    );
  }

  if (block.type === 'faq') {
    const items = Array.isArray(p.items) ? (p.items as Array<{ question?: string; answer?: string }>) : [];
    return (
      <div className="space-y-2">
        <Field label="عنوان بخش" value={str(p, 'headline')} onChange={(v) => set('headline', v)} />
        {items.map((item, i) => (
          <div key={i} className="space-y-2 rounded-lg bg-gray-50 p-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <Field
                  label="سوال"
                  value={item.question ?? ''}
                  onChange={(v) => {
                    const next = [...items];
                    next[i] = { ...item, question: v };
                    set('items', next);
                  }}
                />
              </div>
              <button
                type="button"
                className="mt-5 cursor-pointer text-gray-400 hover:text-error"
                onClick={() => set('items', items.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <Field
              label="پاسخ"
              multiline
              value={item.answer ?? ''}
              onChange={(v) => {
                const next = [...items];
                next[i] = { ...item, answer: v };
                set('items', next);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm cursor-pointer"
          onClick={() => set('items', [...items, { question: '', answer: '' }])}
        >
          <Plus className="h-3 w-3" /> افزودن سوال
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {(['hero', 'text', 'cta', 'products'].includes(block.type)) && (
        <Field label="عنوان" value={str(p, 'headline')} onChange={(v) => set('headline', v)} />
      )}
      {(['hero', 'image'].includes(block.type)) && (
        <Field label="آدرس تصویر" value={str(p, 'imageUrl')} dir="ltr" onChange={(v) => set('imageUrl', v)} />
      )}
      {(['hero', 'cta'].includes(block.type)) && (
        <>
          <Field label="متن دکمه" value={str(p, 'ctaLabel')} onChange={(v) => set('ctaLabel', v)} />
          <Field label="لینک دکمه" value={str(p, 'ctaHref')} dir="ltr" onChange={(v) => set('ctaHref', v)} />
        </>
      )}
      {block.type === 'products' && (
        <Field label="شناسه محصولات (با کاما)" value={str(p, 'productIds')} dir="ltr" onChange={(v) => set('productIds', v)} />
      )}
      {(block.type === 'html' || block.type === 'text' || block.type === 'hero' || block.type === 'cta' || block.type === 'products' || block.type === 'image') && (
        <div className="sm:col-span-2">
          <Field
            label={block.type === 'html' ? 'کد HTML' : block.type === 'image' ? 'توضیح تصویر' : 'متن'}
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
        <div className="flex flex-wrap gap-1">
          {BLOCK_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange([...blocks, createEmptyBlock(type)])}
              className="cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-primary hover:text-primary"
            >
              <Plus className="mr-0.5 inline h-3 w-3" />
              {BLOCK_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {blocks.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          بلوکی اضافه نشده — از دکمه‌های بالا یک نوع انتخاب کنید
        </p>
      )}

      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-xl border border-gray-100 bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              {BLOCK_TYPE_LABELS[block.type]}
            </span>
            <div className="flex gap-1">
              <button type="button" className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700" onClick={() => move(index, index - 1)}>
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700" onClick={() => move(index, index + 1)}>
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-error" onClick={() => removeAt(index)}>
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

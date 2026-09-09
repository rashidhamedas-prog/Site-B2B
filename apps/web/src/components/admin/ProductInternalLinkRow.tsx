'use client';

import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ImagePlus, Link2, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import type { InternalLinkInput, InternalLinkRel } from '@/lib/hooks/useProducts';

const ANCHOR_MAX = 60;
const EXCERPT_MAX = 140;

const REL_LABELS: Record<InternalLinkRel, string> = {
  dofollow: 'dofollow (عادی)',
  nofollow: 'nofollow',
  sponsored: 'sponsored',
};

const inputBase =
  'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2';

export function ProductInternalLinkRow({
  item,
  index,
  total,
  accent,
  onChange,
  onRemove,
  onMove,
}: {
  item: InternalLinkInput;
  index: number;
  total: number;
  accent: 'wholesale' | 'retail';
  onChange: (patch: Partial<InternalLinkInput>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const ring = accent === 'retail' ? 'focus:ring-amber-400/30' : 'focus:ring-primary/30';
  const { upload, uploading } = useImageUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const preview = item.imageUrl || item.cardImageUrl || null;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    try {
      const url = await upload(file);
      onChange({ imageUrl: url });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'خطا در آپلود تصویر');
    }
  };

  return (
    <li className="space-y-2 rounded-lg border border-gray-200 bg-white p-2.5">
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        <div className="min-w-0 flex-1 space-y-2">
          <input
            type="text"
            value={item.anchorText}
            maxLength={ANCHOR_MAX}
            onChange={(e) => onChange({ anchorText: e.target.value })}
            placeholder="متن انکر"
            className={cn(inputBase, ring)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              dir="ltr"
              value={item.targetUrl}
              readOnly={item.targetType !== 'CUSTOM'}
              onChange={(e) => onChange({ targetUrl: e.target.value })}
              className="min-w-[12rem] flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 font-mono text-[11px] text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            <select
              value={item.rel}
              onChange={(e) => onChange({ rel: e.target.value as InternalLinkRel })}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] text-gray-600 focus:outline-none"
            >
              {(Object.keys(REL_LABELS) as InternalLinkRel[]).map((r) => (
                <option key={r} value={r}>
                  {REL_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={item.excerpt || ''}
            maxLength={EXCERPT_MAX}
            rows={2}
            onChange={(e) => onChange({ excerpt: e.target.value || null })}
            placeholder="توضیح کوتاه راهنما (اگر خالی باشد از صفحه هدف برداشته می‌شود)"
            className={cn(inputBase, ring, 'resize-none')}
          />
          <p className="text-[10px] text-gray-400">
            {(item.excerpt || '').length.toLocaleString('fa-IR')} از {EXCERPT_MAX.toLocaleString('fa-IR')}
          </p>
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                  بدون عکس
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e)} />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  آپلود عکس راهنما
                </button>
                {item.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => onChange({ imageUrl: null })}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-500 hover:bg-red-50 hover:text-red-700"
                  >
                    حذف عکس سفارشی
                  </button>
                ) : null}
              </div>
              <p className="text-[10px] leading-relaxed text-gray-400">
                اگر عکس نگذارید، تصویر محصول، دسته یا مقالهٔ هدف استفاده می‌شود.
              </p>
              {uploadError ? <p className="text-[11px] text-red-600">{uploadError}</p> : null}
            </div>
          </div>
          <input
            type="text"
            value={item.title || ''}
            onChange={(e) => onChange({ title: e.target.value || null })}
            placeholder="عنوان tooltip (اختیاری)"
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title="بالا"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className={cn(
              'rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700',
              index === 0 && 'cursor-not-allowed opacity-30',
            )}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="پایین"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className={cn(
              'rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700',
              index === total - 1 && 'cursor-not-allowed opacity-30',
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="حذف"
            onClick={onRemove}
            className="hover:text-error rounded p-1 text-gray-400 hover:bg-red-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

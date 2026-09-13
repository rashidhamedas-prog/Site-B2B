'use client';

import { ImagePlus, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  resolveProductImageAlt,
  sanitizeProductImageAlt,
  suggestProductImageAlt,
  type ProductImageAltDraft,
} from '@/lib/product-image-alt';

export function ProductImageAltEditor({
  images,
  imageAlts,
  draft,
  colorByUrl,
  uploading,
  onUploadClick,
  onRemove,
  onAltChange,
  onSuggestAll,
}: {
  images: string[];
  imageAlts: Record<string, string>;
  draft: ProductImageAltDraft;
  colorByUrl?: Record<string, string>;
  uploading?: boolean;
  onUploadClick: () => void;
  onRemove: (index: number) => void;
  onAltChange: (url: string, alt: string) => void;
  onSuggestAll: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">گالری و متن جایگزین</p>
          <p className="text-[11px] text-gray-500">
            هر عکس یک آلت جدا دارد. همین متن روی PDP، کارت، Open Graph و ImageObject می‌رود.
          </p>
        </div>
        <button
          type="button"
          onClick={onSuggestAll}
          className="btn btn-outline btn-sm inline-flex items-center gap-1 text-xs"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          پیشنهاد آلت خالی‌ها
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {images.map((url, i) => {
          const color = colorByUrl?.[url];
          const suggested = suggestProductImageAlt({ ...draft, color, index: i });
          const value = imageAlts[url] ?? '';
          return (
            <div
              key={`${url}-${i}`}
              className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200">
                <img
                  src={url}
                  alt={resolveProductImageAlt(imageAlts, url, { ...draft, color, index: i })}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white hover:bg-red-600"
                  aria-label={`حذف تصویر ${i + 1}`}
                >
                  ×
                </button>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <label className="block text-[11px] font-medium text-gray-600">
                  آلت تصویر {i + 1}
                  {color ? ` · ${color}` : i === 0 ? ' · از روبرو' : ''}
                </label>
                <textarea
                  value={value}
                  onChange={(e) => onAltChange(url, sanitizeProductImageAlt(e.target.value))}
                  rows={2}
                  maxLength={160}
                  placeholder={suggested}
                  className="focus:ring-primary/30 w-full resize-none rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-gray-400">{value.length}/۱۶۰</p>
                  <button
                    type="button"
                    onClick={() => onAltChange(url, suggested)}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    استفاده از پیشنهاد
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={onUploadClick}
          disabled={uploading}
          className={cn(
            'hover:border-primary hover:text-primary flex min-h-[7.5rem] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-gray-400 transition-colors',
          )}
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="mt-1 text-xs">{uploading ? 'در حال آپلود' : 'آپلود تصویر'}</span>
        </button>
      </div>
    </div>
  );
}

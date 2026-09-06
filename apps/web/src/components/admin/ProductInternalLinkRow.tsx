'use client';

import { ChevronDown, ChevronUp, Link2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { InternalLinkInput, InternalLinkRel } from '@/lib/hooks/useProducts';

const ANCHOR_MAX = 60;

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

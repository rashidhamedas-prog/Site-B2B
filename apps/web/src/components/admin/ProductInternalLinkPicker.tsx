'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import type {
  InternalLinkInput,
  InternalLinkSuggestion,
  InternalLinkTargetType,
} from '@/lib/hooks/useProducts';
import { ProductInternalLinkRow } from './ProductInternalLinkRow';

const MAX_LINKS = 12;
const ANCHOR_MAX = 60;

const TARGET_TYPE_LABELS: Record<InternalLinkTargetType, string> = {
  PRODUCT: 'محصول',
  CATEGORY: 'دسته‌بندی',
  BLOG: 'مقاله بلاگ',
  CUSTOM: 'آدرس دلخواه',
};

const REJECT_LABELS: Record<string, string> = {
  too_many: 'بیش از حد مجاز',
  invalid_target_type: 'نوع هدف نامعتبر',
  anchor_length: 'طول انکر نامعتبر (۱ تا ۶۰)',
  missing_url: 'آدرس هدف خالی',
  self_link: 'لینک به خود محصول',
  duplicate: 'لینک تکراری',
  invalid_rel: 'rel نامعتبر',
  custom_not_internal: 'آدرس دلخواه باید داخلی باشد',
  loop: 'ایجاد حلقه بازگردانی',
  external_url: 'آدرس خارجی مجاز نیست',
  missing_target: 'هدف مشخص نشده',
  target_not_found: 'هدف یافت نشد',
  not_visible_in_channel: 'در این کانال نمایش داده نمی‌شود',
  noindex: 'هدف noindex است',
};

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  return `il-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function dedupKey(l: { targetType: string; targetId: string | null; targetUrl: string }): string {
  return `${l.targetType}|${l.targetId || ''}|${l.targetUrl}`;
}

type ValidateRejected = { index: number; reason: string; anchorText?: string; targetUrl?: string };
const inputBase = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2';

export function ProductInternalLinkPicker({
  channel,
  value,
  onChange,
  productId,
  accent = 'wholesale',
}: {
  channel: 'RETAIL' | 'WHOLESALE';
  value: InternalLinkInput[];
  onChange: (items: InternalLinkInput[]) => void;
  productId?: string;
  accent?: 'wholesale' | 'retail';
}) {
  const [targetType, setTargetType] = useState<InternalLinkTargetType>('PRODUCT');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<InternalLinkSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customAnchor, setCustomAnchor] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationMsg, setValidationMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const atLimit = value.length >= MAX_LINKS;
  const ring = accent === 'retail' ? 'focus:ring-amber-400/30' : 'focus:ring-primary/30';
  const accentBorder = accent === 'retail' ? 'border-amber-200' : 'border-primary/15';
  const accentBg = accent === 'retail' ? 'bg-amber-50/40' : 'bg-primary-50/40';
  const accentText = accent === 'retail' ? 'text-amber-900' : 'text-primary-dark';
  const tabActive = accent === 'retail' ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-primary bg-primary-50 text-primary-dark';

  const runSearch = useCallback(
    async (term: string) => {
      if (targetType === 'CUSTOM') {
        setHits([]);
        return;
      }
      if (term.trim().length < 1 && targetType !== 'PRODUCT') {
        setHits([]);
        return;
      }
      setSearching(true);
      try {
        const res = await apiClient.post<InternalLinkSuggestion[]>(
          '/products/admin/internal-links/suggest',
          { channel, productId, q: term.trim(), targetType, limit: 8 },
        );
        setHits(Array.isArray(res) ? res : []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    },
    [channel, productId, targetType],
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void runSearch(query);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    setQuery('');
    setHits([]);
    if (targetType === 'PRODUCT') void runSearch('');
  }, [targetType, runSearch]);

  const addSuggestion = (s: InternalLinkSuggestion) => {
    if (atLimit) return;
    const item: InternalLinkInput = {
      id: newId(),
      targetType: s.targetType,
      targetId: s.id,
      targetUrl: s.url,
      anchorText: s.suggestedAnchor.slice(0, ANCHOR_MAX),
      title: null,
      rel: 'dofollow',
      sortOrder: value.length,
    };
    if (value.some((l) => dedupKey(l) === dedupKey(item))) return;
    onChange([...value, item]);
    setHits((prev) => prev.filter((h) => h.id !== s.id));
  };

  const addCustom = () => {
    if (atLimit) return;
    const url = customUrl.trim();
    const anchor = customAnchor.trim();
    if (!url || !anchor) return;
    const item: InternalLinkInput = {
      id: newId(),
      targetType: 'CUSTOM',
      targetId: null,
      targetUrl: url,
      anchorText: anchor.slice(0, ANCHOR_MAX),
      title: null,
      rel: 'dofollow',
      sortOrder: value.length,
    };
    if (value.some((l) => dedupKey(l) === dedupKey(item))) return;
    onChange([...value, item]);
    setCustomUrl('');
    setCustomAnchor('');
  };

  const update = (id: string, patch: Partial<InternalLinkInput>) =>
    onChange(value.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => onChange(value.filter((l) => l.id !== id));
  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= value.length) return;
    const copy = [...value];
    const [row] = copy.splice(index, 1);
    copy.splice(next, 0, row);
    onChange(copy.map((l, i) => ({ ...l, sortOrder: i })));
  };

  const runValidate = async () => {
    setValidating(true);
    setValidationMsg(null);
    try {
      const res = await apiClient.post<{ ok: unknown[]; rejected: ValidateRejected[]; count: number }>(
        '/products/admin/internal-links/validate',
        { channel, productId, links: value },
      );
      const rejected = Array.isArray(res?.rejected) ? res.rejected : [];
      if (!rejected.length) {
        setValidationMsg({ kind: 'ok', text: `${value.length} لینک بررسی شد — همه معتبرند.` });
      } else {
        const lines = rejected.slice(0, 6).map((r) => `«${r.anchorText || ''}»: ${REJECT_LABELS[r.reason] || r.reason}`);
        setValidationMsg({ kind: 'err', text: `${rejected.length} لینک نامعتبر — ${lines.join('، ')}` });
      }
    } catch {
      setValidationMsg({ kind: 'err', text: 'بررسی لینک ناموفق بود.' });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className={cn('space-y-3 rounded-xl border p-4', accentBorder, accentBg)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-sm font-semibold', accentText)}>
          لینک‌های داخلی سئو — {channel === 'RETAIL' ? 'سایت تکی (.ir)' : 'سایت عمده (.com)'}
        </p>
        <p className="text-[11px] text-gray-400">{value.length} از {MAX_LINKS}</p>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-500">
        فقط در همین کانال نمایش داده می‌شوند و به صفحات هم‌کانال اشاره می‌کنند. انکر را با کلمه کلیدی هدف بنویسید (۱ تا ۶۰ کاراکتر).
      </p>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(TARGET_TYPE_LABELS) as InternalLinkTargetType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTargetType(t)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[11px] transition-colors',
              targetType === t ? tabActive : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            {TARGET_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {targetType === 'CUSTOM' ? (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
          <input
            type="url"
            dir="ltr"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="آدرس داخلی، مثلاً /category/shomiz"
            className={cn(inputBase, ring)}
          />
          <input
            type="text"
            value={customAnchor}
            onChange={(e) => setCustomAnchor(e.target.value)}
            maxLength={ANCHOR_MAX}
            placeholder="متن انکر لینک"
            className={cn(inputBase, ring)}
          />
          <button
            type="button"
            disabled={atLimit || !customUrl.trim() || !customAnchor.trim()}
            onClick={addCustom}
            className="btn btn-outline btn-sm w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            افزودن لینک دلخواه
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`جستجوی ${TARGET_TYPE_LABELS[targetType]}…`}
              className={cn(inputBase, 'bg-white pl-3 pr-9', ring)}
            />
          </div>
          {searching ? <p className="text-[11px] text-gray-400">در حال جستجو…</p> : null}
          {hits.length > 0 ? (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-100 bg-white">
              {hits.map((h) => (
                <li key={`${h.targetType}-${h.id}`}>
                  <button
                    type="button"
                    disabled={atLimit}
                    onClick={() => addSuggestion(h)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gray-800">{h.title}</span>
                      <span className="block truncate font-mono text-[11px] text-gray-400" dir="ltr">{h.url}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-gray-400">انکر: {h.suggestedAnchor}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      {atLimit ? <p className="text-[11px] text-amber-700">به سقف {MAX_LINKS} لینک رسیده‌اید.</p> : null}

      {value.length === 0 ? (
        <p className="text-xs text-gray-400">هنوز لینک داخلی اضافه نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((item, index) => (
            <ProductInternalLinkRow
              key={item.id}
              item={item}
              index={index}
              total={value.length}
              accent={accent}
              onChange={(patch) => update(item.id, patch)}
              onRemove={() => remove(item.id)}
              onMove={(dir) => move(index, dir)}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={validating || value.length === 0}
        onClick={() => void runValidate()}
        className="btn btn-outline btn-sm w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {validating ? 'در حال بررسی…' : 'بررسی اعتبار لینک‌ها'}
      </button>
      {validationMsg ? (
        <p
          className={cn(
            'rounded-lg px-3 py-2 text-[11px] leading-relaxed',
            validationMsg.kind === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
          )}
        >
          {validationMsg.text}
        </p>
      ) : null}
    </div>
  );
}

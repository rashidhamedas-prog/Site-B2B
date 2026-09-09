'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { searchAdminProducts } from '@/lib/hooks/useProducts';
import {
  PRODUCTS_BLOCK_HOME_CAP,
  parseProductIds,
  productsBlockPropsForSave,
  resolveProductsBlockSource,
  serializeProductIds,
  type ProductsBlockSource,
} from '@/lib/cms/products-block';
import type { ContentBlock } from '@/lib/cms/types';
import { ProductRelatedPicker, type RelatedProductPick } from './ProductRelatedPicker';

function str(props: Record<string, unknown>, key: string): string {
  const v = props[key];
  return typeof v === 'string' ? v : '';
}

type CategoryRow = { id: string; name: string };

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'views', label: 'پربازدیدترین' },
  { value: 'discounted', label: 'تخفیف‌دار' },
];

function toPick(row: {
  id: string;
  name?: string;
  sku?: string;
  images?: string[];
}): RelatedProductPick {
  return {
    id: row.id,
    name: row.name || row.sku || row.id,
    sku: row.sku,
    images: Array.isArray(row.images) ? row.images : [],
  };
}

export function AdminProductsBlockFields({
  block,
  onChange,
  channel = 'WHOLESALE',
}: {
  block: ContentBlock;
  onChange: (b: ContentBlock) => void;
  channel?: 'RETAIL' | 'WHOLESALE';
}) {
  const p = block.props;
  const set = (key: string, value: unknown) =>
    onChange({ ...block, props: { ...block.props, [key]: value } });
  const ids = parseProductIds(p.productIds);
  const source = resolveProductsBlockSource(p, ids);
  const [picks, setPicks] = useState<RelatedProductPick[]>([]);
  const [draftManualIds, setDraftManualIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  const setSource = (next: ProductsBlockSource) => {
    if (next === 'auto') {
      if (ids.length) setDraftManualIds(ids);
      onChange({
        ...block,
        props: productsBlockPropsForSave({ ...block.props, source: 'auto', productIds: '' }, channel),
      });
      setPicks([]);
      return;
    }
    const restore = ids.length ? ids : draftManualIds;
    onChange({
      ...block,
      props: productsBlockPropsForSave(
        { ...block.props, source: 'manual', productIds: serializeProductIds(restore) },
        channel,
      ),
    });
  };

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<CategoryRow[] | { data: CategoryRow[] }>('/categories')
      .then((res) => {
        const rows = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        if (!cancelled) setCategories(rows.filter((c) => c.id && c.name));
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!ids.length) {
      setPicks([]);
      return;
    }
    searchAdminProducts('', { ids, channel, limit: PRODUCTS_BLOCK_HOME_CAP })
      .then((rows) => {
        if (cancelled) return;
        const byId = new Map(rows.map((row) => [row.id, toPick(row)]));
        setPicks(
          ids.map((id) => byId.get(id) || { id, name: 'محصول ذخیره‌شده', sku: id.slice(0, 8) }),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setPicks(ids.map((id) => ({ id, name: 'محصول ذخیره‌شده', sku: id.slice(0, 8) })));
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-hydrate when the saved id list changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(','), channel]);

  const onPicks = (items: RelatedProductPick[]) => {
    setPicks(items);
    setDraftManualIds(items.map((item) => item.id));
    onChange({
      ...block,
      props: productsBlockPropsForSave(
        {
          ...block.props,
          source: 'manual',
          productIds: serializeProductIds(items.map((item) => item.id)),
        },
        channel,
      ),
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={p.enabled !== false}
            onChange={(e) => set('enabled', e.target.checked)}
            className="text-primary focus:ring-primary/30 h-4 w-4 rounded border-gray-300"
          />
          نمایش این بخش در ویترین
        </label>
        <p className="mt-1 text-[11px] text-gray-500">
          این بلوک مدل‌های همین کانال ({channel === 'RETAIL' ? 'فروش تکی' : 'فروش عمده'}) را نشان
          می‌دهد. قیمت و موجودی از کاتالوگ زنده می‌آید، نه از این فرم.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-gray-500">ابرو / برچسب بالا</label>
        <input
          value={str(p, 'eyebrow')}
          onChange={(e) => set('eyebrow', e.target.value)}
          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-gray-500">عنوان</label>
        <input
          value={str(p, 'headline')}
          onChange={(e) => set('headline', e.target.value)}
          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-[11px] font-medium text-gray-500">متن معرفی</label>
        <textarea
          rows={2}
          value={str(p, 'body')}
          onChange={(e) => set('body', e.target.value)}
          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-gray-500">متن دکمه مشاهده همه</label>
        <input
          value={str(p, 'viewAllLabel') || str(p, 'ctaLabel')}
          onChange={(e) =>
            onChange({
              ...block,
              props: {
                ...block.props,
                viewAllLabel: e.target.value,
                ctaLabel: e.target.value,
              },
            })
          }
          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-medium text-gray-500">لینک دکمه</label>
        <input
          dir="ltr"
          value={str(p, 'ctaHref') || '/products'}
          onChange={(e) => set('ctaHref', e.target.value)}
          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      </div>

      <div className="sm:col-span-2">
        <p className="mb-2 text-[11px] font-medium text-gray-500">منبع محصولات</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'auto', label: 'خودکار از کاتالوگ' },
              { id: 'manual', label: 'انتخاب دستی' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSource(opt.id)}
              className={
                source === opt.id
                  ? 'bg-primary cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-white'
                  : 'cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600'
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
        {source === 'auto' ? (
          <p className="mt-2 text-[11px] text-gray-500">
            در حالت خودکار، چینش دستی ذخیره نمی‌شود و ویترین از کاتالوگ ساخته می‌شود.
          </p>
        ) : null}
      </div>

      {source === 'auto' ? (
        <>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">مرتب‌سازی</label>
            <select
              value={str(p, 'sort') || (channel === 'RETAIL' ? 'newest' : 'discounted')}
              onChange={(e) => set('sort', e.target.value)}
              className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">دسته (اختیاری)</label>
            <select
              value={str(p, 'categoryId')}
              onChange={(e) => set('categoryId', e.target.value)}
              className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            >
              <option value="">همه دسته‌ها</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">
              تعداد نمایش (حداکثر {PRODUCTS_BLOCK_HOME_CAP})
            </label>
            <input
              dir="ltr"
              value={String(typeof p.limit === 'number' ? p.limit : channel === 'WHOLESALE' ? 6 : 12)}
              onChange={(e) =>
                set('limit', Math.min(PRODUCTS_BLOCK_HOME_CAP, Math.max(1, Number(e.target.value) || 1)))
              }
              className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={p.inStockOnly === true}
              onChange={(e) => set('inStockOnly', e.target.checked)}
              className="text-primary focus:ring-primary/30 h-4 w-4 rounded border-gray-300"
            />
            فقط مدل‌های موجود
          </label>
        </>
      ) : (
        <div className="sm:col-span-2">
          <ProductRelatedPicker
            value={picks}
            onChange={onPicks}
            max={PRODUCTS_BLOCK_HOME_CAP}
            channel={channel}
            title="چینش ویترین"
            hint="جستجو کنید، اضافه کنید، با فلش بالا/پایین ترتیب را عوض کنید. مدل ناموجود یا خاموش در این کانال روی سایت دیده نمی‌شود."
            emptyLabel="هنوز مدلی انتخاب نشده — اگر خالی بماند بخش روی ویترین پنهان می‌شود."
          />
        </div>
      )}

      {channel === 'WHOLESALE' ? (
        <div className="sm:col-span-2 space-y-2 rounded-lg border border-gray-100 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={p.showPortalCta !== false}
              onChange={(e) => set('showPortalCta', e.target.checked)}
              className="text-primary focus:ring-primary/30 h-4 w-4 rounded border-gray-300"
            />
            جعبه ورود پنل زیر محصولات
          </label>
          {p.showPortalCta !== false ? (
            <>
              <textarea
                rows={2}
                value={
                  str(p, 'portalBody') ||
                  'برای مشاهده قیمت‌های عمده و ثبت سفارش آنلاین، ابتدا وارد پنل مشتری شوید'
                }
                onChange={(e) => set('portalBody', e.target.value)}
                className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={str(p, 'portalLoginLabel') || 'ورود به پنل'}
                  onChange={(e) => set('portalLoginLabel', e.target.value)}
                  className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                />
                <input
                  value={str(p, 'portalRegisterLabel') || 'ثبت‌نام عمده‌فروش'}
                  onChange={(e) => set('portalRegisterLabel', e.target.value)}
                  className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

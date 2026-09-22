'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  PRODUCT_LIST_STATUS_LABEL,
  PRODUCT_LIST_STATUSES,
  UNCATEGORIZED_CATEGORY,
  productListFilterChips,
  productListFilterCount,
  type ProductListFilterKey,
  type ProductWorkspaceQuery,
} from '@/lib/admin-product-workspace';

type CategoryOption = { id: string; name: string; status?: string };
type CollectionOption = { id: string; name: string };

const selectClass =
  'min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

export function AdminProductListFilters({
  query,
  categories,
  collections,
  onChange,
  onClear,
}: {
  query: ProductWorkspaceQuery;
  categories: CategoryOption[];
  collections: CollectionOption[];
  onChange: (patch: Partial<ProductWorkspaceQuery>) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const wasOpen = useRef(false);
  const count = productListFilterCount(query);
  const categoryName = categories.find((row) => row.id === query.categoryId)?.name;
  const collectionName = collections.find((row) => row.id === query.collectionId)?.name;
  const chips = productListFilterChips(query, { categoryName, collectionName });
  const orderedCategories = [...categories].sort((a, b) => {
    const aHidden = a.status && a.status !== 'ACTIVE' ? 1 : 0;
    const bHidden = b.status && b.status !== 'ACTIVE' ? 1 : 0;
    return aHidden - bHidden;
  });

  useEffect(() => {
    if (open) {
      categoryRef.current?.focus();
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) buttonRef.current?.focus();
  }, [open]);

  const clearChip = (key: ProductListFilterKey) => {
    if (key === 'categoryId') onChange({ categoryId: '' });
    else if (key === 'status') onChange({ status: 'ALL' });
    else if (key === 'collectionId') onChange({ collectionId: '' });
    else onChange({ inStock: false });
  };

  return (
    <div className="contents">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          open || count > 0
            ? 'border-primary/30 bg-primary/5 text-primary'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
        )}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        فیلتر پیشرفته
        {count > 0 ? (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">
            {count.toLocaleString('fa-IR')}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="فیلتر پیشرفته محصولات"
          className="grid w-full basis-full gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <label className="block text-xs font-medium text-gray-600">
            دسته‌بندی
            <select
              ref={categoryRef}
              className={cn(selectClass, 'mt-1')}
              value={query.categoryId}
              onChange={(event) => onChange({ categoryId: event.target.value })}
            >
              <option value="">همه دسته‌ها</option>
              <option value={UNCATEGORIZED_CATEGORY}>بدون دسته‌بندی</option>
              {orderedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.status && category.status !== 'ACTIVE' ? ' (مخفی)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-gray-600">
            وضعیت
            <select
              className={cn(selectClass, 'mt-1')}
              value={query.status}
              onChange={(event) =>
                onChange({ status: event.target.value as ProductWorkspaceQuery['status'] })
              }
            >
              {PRODUCT_LIST_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PRODUCT_LIST_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-gray-600">
            کالکشن
            <select
              className={cn(selectClass, 'mt-1')}
              value={query.collectionId}
              onChange={(event) => onChange({ collectionId: event.target.value })}
            >
              <option value="">همه کالکشن‌ها</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-h-11 items-end gap-2 pb-2 text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              checked={query.inStock}
              onChange={(event) => onChange({ inStock: event.target.checked })}
            />
            فقط موجود
            <span className="text-xs font-normal text-gray-500">
              {query.channel === 'RETAIL'
                ? 'تکی'
                : query.channel === 'WHOLESALE'
                  ? 'عمده'
                  : 'تکی یا عمده'}
            </span>
          </label>

          {count > 0 ? (
            <div className="sm:col-span-2 xl:col-span-4">
              <button type="button" onClick={onClear} className="btn btn-outline btn-sm min-h-11">
                پاک کردن فیلتر پیشرفته
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {chips.length > 0 ? (
        <ul className="flex w-full basis-full flex-wrap gap-2" aria-label="فیلترهای فعال">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => clearChip(chip.key)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {chip.label}
                <X className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">حذف</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

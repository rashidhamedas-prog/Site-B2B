'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CatalogFilterRail, type CatalogFilterTone, type CatalogCollectionOption } from './CatalogFilterRail';
import type { CatalogFilterValues } from '@/lib/catalog-filter';

type Props = {
  values: CatalogFilterValues;
  onChange: (key: keyof CatalogFilterValues, value: string) => void;
  onReplace: (next: CatalogFilterValues) => void;
  onReset: () => void;
  tone: CatalogFilterTone;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  extraFabrics?: string[];
  extraColors?: string[];
  garmentSizes?: string[];
  collections?: CatalogCollectionOption[];
  showPrice?: boolean;
  showCollar?: boolean;
  showCollections?: boolean;
  resultCount?: number;
  loading?: boolean;
};

export function CatalogFilters({
  values,
  onChange,
  onReplace,
  onReset,
  tone,
  mobileOpen,
  onMobileOpenChange,
  extraFabrics,
  extraColors,
  garmentSizes,
  collections,
  showPrice,
  showCollar,
  showCollections,
  resultCount,
  loading,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<CatalogFilterValues>(values);

  useEffect(() => {
    if (mobileOpen) setDraft(values);
  }, [mobileOpen, values]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen, onMobileOpenChange]);

  const setDraftField = (key: keyof CatalogFilterValues, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const applyDraft = () => {
    onReplace(draft);
    onMobileOpenChange(false);
  };

  const resetDraft = () => {
    setDraft({});
  };

  const shared = {
    extraFabrics,
    extraColors,
    garmentSizes,
    collections,
    showPrice,
    showCollar,
    showCollections,
    resultCount,
    loading,
    tone,
  };

  return (
    <>
      <aside className="hidden w-72 shrink-0 lg:block">
        <div
          className="catalog-filter-shell sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto"
          data-tone={tone}
        >
          <CatalogFilterRail values={values} onChange={onChange} onReset={onReset} {...shared} />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="lg:hidden">
          <button
            type="button"
            className="catalog-filter-backdrop"
            aria-label="بستن فیلترها"
            onClick={() => onMobileOpenChange(false)}
          />
          <aside
            id="catalog-filter-drawer"
            className="catalog-filter-drawer"
            data-tone={tone}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="flex items-center justify-between border-b border-[var(--cf-border)] px-4 py-3">
              <h3 id={titleId} className="text-sm font-extrabold text-[var(--cf-fg)]">
                فیلتر مدل‌ها
              </h3>
              <button
                ref={closeRef}
                type="button"
                onClick={() => onMobileOpenChange(false)}
                className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[var(--cf-fg)] transition-opacity duration-200 hover:bg-[var(--cf-muted-bg)]"
                aria-label="بستن فیلترها"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
              <CatalogFilterRail
                values={draft}
                onChange={setDraftField}
                onReset={resetDraft}
                {...shared}
              />
            </div>
            <div className="border-t border-[var(--cf-border)] p-4">
              <button type="button" onClick={applyDraft} className="catalog-filter-apply w-full">
                نمایش نتایج
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

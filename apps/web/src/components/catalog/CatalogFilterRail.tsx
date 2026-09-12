'use client';

import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  catalogColorHex,
  catalogFilterChips,
  isLightCatalogSwatch,
  mergeCatalogColors,
  mergeCatalogFabrics,
  toggleCatalogValue,
  type CatalogFilterValues,
  CATALOG_SIZE_TYPES,
} from '@/lib/catalog-filter';

export type CatalogFilterTone = 'wholesale' | 'retail';

export type CatalogCollectionOption = { id: string; name: string };

type Props = {
  values: CatalogFilterValues;
  onChange: (key: keyof CatalogFilterValues, value: string) => void;
  onReset: () => void;
  tone: CatalogFilterTone;
  extraFabrics?: string[];
  extraColors?: string[];
  garmentSizes?: string[];
  collections?: CatalogCollectionOption[];
  showPrice?: boolean;
  showCollar?: boolean;
  showCollections?: boolean;
  resultCount?: number;
  loading?: boolean;
  applyMode?: boolean;
  onApply?: () => void;
};

function FilterGroup({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details defaultOpen={defaultOpen} className="catalog-filter-group">
      <summary className="catalog-filter-summary">
        <span>{title}</span>
        <ChevronDown className="catalog-filter-chevron" aria-hidden />
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}

export function CatalogActiveChips({
  values,
  onChange,
  onReset,
  collectionName,
}: {
  values: CatalogFilterValues;
  onChange: (key: keyof CatalogFilterValues, value: string) => void;
  onReset: () => void;
  collectionName?: string;
}) {
  const chips = catalogFilterChips(values, collectionName);
  if (!chips.length) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={`${chip.key}-${chip.value}`}
          type="button"
          onClick={() => onChange(chip.key, '')}
          className="catalog-filter-chip"
        >
          <span className="min-w-0 truncate">{chip.label}</span>
          <span aria-hidden className="text-[11px] leading-none">
            ×
          </span>
          <span className="sr-only">حذف {chip.label}</span>
        </button>
      ))}
      <button type="button" onClick={onReset} className="catalog-filter-clear-inline">
        حذف همه
      </button>
    </div>
  );
}

export function CatalogFilterRail({
  values,
  onChange,
  onReset,
  tone,
  extraFabrics = [],
  extraColors = [],
  garmentSizes = [],
  collections = [],
  showPrice = false,
  showCollar = false,
  showCollections = false,
  resultCount,
  loading = false,
  applyMode = false,
  onApply,
}: Props) {
  const fabrics = mergeCatalogFabrics(extraFabrics);
  const colors = mergeCatalogColors(extraColors);
  const active = catalogFilterChips(values).length;
  const stockOn = values.inStock === '1' || values.inStock === 'true';

  return (
    <div className="catalog-filter-rail" data-tone={tone}>
      <div className="catalog-filter-head">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--cf-gold)]">انتخاب دقیق‌تر</p>
          <h3 className="mt-0.5 text-sm font-extrabold text-[var(--cf-fg)]">محدود کردن مدل‌ها</h3>
        </div>
        {active > 0 ? (
          <span className="catalog-filter-count">{active.toLocaleString('fa-IR')}</span>
        ) : null}
      </div>

      <div className="catalog-filter-body">
        <div className="catalog-filter-stock">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--cf-fg)]">فقط موجود</p>
            <p className="text-[11px] text-[var(--cf-muted)]">مدل‌های بدون موجودی کنار می‌روند</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={stockOn}
            aria-label="فقط مدل‌های موجود"
            onClick={() => onChange('inStock', stockOn ? '' : '1')}
            className={cn('catalog-filter-switch', stockOn && 'is-on')}
          >
            <span className="catalog-filter-switch-knob" />
          </button>
        </div>

        <FilterGroup title="نوع پارچه">
          <div className="flex flex-wrap gap-1.5">
            {fabrics.map((fabric) => {
              const selected = values.fabric === fabric;
              return (
                <button
                  key={fabric}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange('fabric', toggleCatalogValue(values.fabric, fabric))}
                  className={cn('catalog-fabric-chip', selected && 'is-selected')}
                >
                  <span className="catalog-fabric-swatch" data-fabric={fabric} aria-hidden />
                  {fabric}
                </button>
              );
            })}
          </div>
        </FilterGroup>

        <FilterGroup title="سایزبندی">
          <div className="grid grid-cols-3 gap-1.5">
            {CATALOG_SIZE_TYPES.map((size) => {
              const selected = values.size === size.value;
              return (
                <button
                  key={size.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange('size', toggleCatalogValue(values.size, size.value))}
                  className={cn('catalog-size-card', selected && 'is-selected')}
                >
                  <span className="text-[11px] font-extrabold">{size.label}</span>
                  <span className="text-[10px] text-[var(--cf-muted)]">{size.hint}</span>
                </button>
              );
            })}
          </div>
          {garmentSizes.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {garmentSizes.map((size) => {
                const selected = values.size === size;
                return (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange('size', toggleCatalogValue(values.size, size))}
                    className={cn('catalog-fabric-chip', selected && 'is-selected')}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          ) : null}
        </FilterGroup>

        <FilterGroup title="رنگ">
          <div className="grid grid-cols-4 gap-2">
            {colors.map((color) => {
              const selected = values.color === color.name;
              const hex = catalogColorHex(color.name, color.hex);
              const light = isLightCatalogSwatch(hex);
              return (
                <button
                  key={color.name}
                  type="button"
                  aria-pressed={selected}
                  aria-label={color.name}
                  title={color.name}
                  onClick={() => onChange('color', toggleCatalogValue(values.color, color.name))}
                  className="catalog-color-option"
                >
                  <span
                    className={cn('catalog-color-swatch', selected && 'is-selected', light && 'is-light')}
                    style={{ backgroundColor: hex }}
                  >
                    {selected ? (
                      <Check
                        className={cn('h-3.5 w-3.5', light ? 'text-[var(--cf-fg)]' : 'text-white')}
                        strokeWidth={3}
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  <span className="catalog-color-name">{color.name}</span>
                </button>
              );
            })}
          </div>
        </FilterGroup>

        {showPrice ? (
          <FilterGroup title="قیمت (تومان)" defaultOpen={Boolean(values.minPrice || values.maxPrice)}>
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="mb-1 block text-[11px] text-[var(--cf-muted)]">از</span>
                <input
                  className="catalog-filter-input"
                  inputMode="numeric"
                  placeholder="مثلاً ۸۹۰"
                  value={values.minPrice || ''}
                  onChange={(e) => onChange('minPrice', e.target.value.replace(/[^\d]/g, ''))}
                />
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[11px] text-[var(--cf-muted)]">تا</span>
                <input
                  className="catalog-filter-input"
                  inputMode="numeric"
                  placeholder="مثلاً ۲۹۰۰"
                  value={values.maxPrice || ''}
                  onChange={(e) => onChange('maxPrice', e.target.value.replace(/[^\d]/g, ''))}
                />
              </label>
            </div>
          </FilterGroup>
        ) : null}

        {showCollections && collections.length ? (
          <FilterGroup title="کالکشن" defaultOpen={Boolean(values.collectionId)}>
            <div className="flex flex-col gap-1">
              {collections.map((collection) => {
                const selected = values.collectionId === collection.id;
                return (
                  <button
                    key={collection.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      onChange('collectionId', toggleCatalogValue(values.collectionId, collection.id))
                    }
                    className={cn('catalog-collection-row', selected && 'is-selected')}
                  >
                    {collection.name}
                  </button>
                );
              })}
            </div>
          </FilterGroup>
        ) : null}

        {showCollar ? (
          <FilterGroup title="مدل یقه" defaultOpen={Boolean(values.collar)}>
            <input
              className="catalog-filter-input"
              placeholder="مثلاً ایستاده"
              value={values.collar || ''}
              onChange={(e) => onChange('collar', e.target.value)}
            />
          </FilterGroup>
        ) : null}
      </div>

      <div className="catalog-filter-foot">
        {active > 0 ? (
          <button type="button" onClick={onReset} className="catalog-filter-reset">
            پاک کردن فیلترها
          </button>
        ) : (
          <p className="px-1 text-[11px] text-[var(--cf-muted)]">
            {tone === 'wholesale'
              ? 'پارچه، رنگ و سایز را برای سفارش عمده مشخص کنید.'
              : 'پارچه، رنگ و سایز را انتخاب کنید تا مدل مناسب‌تان بماند.'}
          </p>
        )}
        {applyMode ? (
          <button type="button" onClick={onApply} className="catalog-filter-apply">
            {loading
              ? 'در حال آماده‌سازی…'
              : typeof resultCount === 'number'
                ? `نمایش ${resultCount.toLocaleString('fa-IR')} مدل`
                : 'نمایش نتایج'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

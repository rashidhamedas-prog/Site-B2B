'use client';

import { useId, type ReactNode } from 'react';
import { MapPin, UserRound, Smartphone } from 'lucide-react';
import type { CheckoutAppearance } from '@/lib/checkout-payment-ui';
import {
  OTHER_CITY,
  citySelectValue,
  citiesForProvince,
  defaultCityForProvince,
} from '@/lib/iran-geo';
import { IRAN_PROVINCES } from '@/lib/iran-provinces';
import { shapeFaDigits } from '@/lib/iran-digits';
import {
  addressesMatch,
  composeStreetLine,
  hydrateShippingAddress,
  postalDigits,
  torobpayAddressChecklist,
  validateShippingAddress,
  type AddressErrors,
  type AddressMode,
  type ShippingAddress,
} from '@/lib/shipping-address';
import { cn } from '@/lib/cn';

const fieldChrome = {
  retail:
    'w-full min-w-0 rounded-xl border border-[var(--retail-border)] bg-white px-3 py-2.5 text-sm text-[var(--retail-ink)] placeholder:text-[var(--retail-muted)] transition-[border-color,box-shadow,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)]',
  wholesale:
    'w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
} as const;

const errorChrome = {
  retail: 'border-red-400 focus-visible:ring-red-400',
  wholesale: 'border-error focus-visible:ring-error/40',
} as const;

const labelChrome = {
  retail: 'mb-1 block text-sm font-bold text-[var(--retail-ink)]',
  wholesale: 'mb-1 block text-sm font-bold text-gray-800',
} as const;

const muted = {
  retail: 'text-[var(--retail-muted)]',
  wholesale: 'text-gray-500',
} as const;

export function ShippingAddressForm({
  appearance,
  value,
  onChange,
  savedAddresses = [],
  onSelectSaved,
  mode = 'standard',
  showErrors = false,
}: {
  appearance: CheckoutAppearance;
  value: ShippingAddress;
  onChange: (next: ShippingAddress) => void;
  savedAddresses?: ShippingAddress[];
  onSelectSaved?: (next: ShippingAddress) => void;
  mode?: AddressMode;
  showErrors?: boolean;
}) {
  const uid = useId();
  const errors: AddressErrors = showErrors || mode === 'torobpay'
    ? validateShippingAddress(value, mode)
    : {};
  const reveal = showErrors || mode === 'torobpay';
  const fieldClass = fieldChrome[appearance];
  const cityValue = citySelectValue(value.province, value.city);
  const checklist = mode === 'torobpay' ? torobpayAddressChecklist(value) : [];
  const postalShown = shapeFaDigits(postalDigits(value.postalCode));

  const set = (patch: Partial<ShippingAddress>) => onChange({ ...value, ...patch });

  const control = (name: keyof AddressErrors) =>
    cn(fieldClass, reveal && errors[name] ? errorChrome[appearance] : null);

  return (
    <div className="space-y-4">
      {savedAddresses.length > 0 ? (
        <fieldset className="min-w-0">
          <legend className={cn('mb-2 text-xs font-bold', muted[appearance])}>آدرس‌های ذخیره‌شده</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {savedAddresses.map((row, i) => {
              const selected = addressesMatch(row, value);
              const apply = () => onSelectSaved?.(hydrateShippingAddress(row));
              return (
                <label
                  key={`${row.city}-${row.street}-${i}`}
                  className={cn(
                    'flex min-w-0 cursor-pointer items-start gap-2 rounded-2xl border px-3 py-2.5 text-right transition-[border-color,opacity] duration-150',
                    appearance === 'retail'
                      ? selected
                        ? 'border-[var(--retail-gold)] bg-[var(--retail-gold)]/5'
                        : 'border-[var(--retail-border)] bg-white hover:border-[var(--retail-gold)]'
                      : selected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-white hover:border-primary/40',
                  )}
                >
                  <input
                    type="radio"
                    name={`${uid}-saved`}
                    checked={selected}
                    onChange={apply}
                    onClick={apply}
                    className="mt-1 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{row.recipient || 'گیرنده'}</span>
                    <span className={cn('mt-0.5 block truncate text-xs', muted[appearance])}>
                      {row.city} — {composeStreetLine(hydrateShippingAddress(row))}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          appearance={appearance}
          id={`${uid}-recipient`}
          label="نام گیرنده"
          hint="همان نام روی کارت شناسایی"
          error={reveal ? errors.recipient : undefined}
        >
          <span className="relative block min-w-0">
            <UserRound className={cn('pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2', muted[appearance])} aria-hidden />
            <input
              id={`${uid}-recipient`}
              className={cn(control('recipient'), 'pr-10')}
              value={value.recipient}
              autoComplete="name"
              onChange={(e) => set({ recipient: e.target.value })}
            />
          </span>
        </Field>
        <Field
          appearance={appearance}
          id={`${uid}-mobile`}
          label="موبایل گیرنده"
          hint="با ۰۹ شروع شود"
          error={reveal ? errors.mobile : undefined}
        >
          <span className="relative block min-w-0">
            <Smartphone className={cn('pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2', muted[appearance])} aria-hidden />
            <input
              id={`${uid}-mobile`}
              className={cn(control('mobile'), 'pr-10')}
              value={value.mobile}
              inputMode="tel"
              dir="ltr"
              autoComplete="tel"
              onChange={(e) => set({ mobile: e.target.value })}
            />
          </span>
        </Field>
        <Field appearance={appearance} id={`${uid}-province`} label="استان" error={reveal ? errors.province : undefined}>
          <select
            id={`${uid}-province`}
            className={control('province')}
            value={value.province}
            onChange={(e) => {
              const province = e.target.value;
              const nextCity =
                citiesForProvince(province).includes(value.city) ? value.city : defaultCityForProvince(province);
              set({ province, city: nextCity });
            }}
          >
            {IRAN_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field appearance={appearance} id={`${uid}-city`} label="شهر" error={reveal ? errors.city : undefined}>
          <select
            id={`${uid}-city`}
            className={control('city')}
            value={cityValue}
            onChange={(e) => {
              const next = e.target.value;
              if (next === OTHER_CITY) set({ city: '' });
              else set({ city: next });
            }}
          >
            {citiesForProvince(value.province).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value={OTHER_CITY}>شهر دیگر…</option>
          </select>
        </Field>
        {cityValue === OTHER_CITY ? (
          <label className="block min-w-0 text-sm sm:col-span-2">
            <span className={labelChrome[appearance]}>نام شهر</span>
            <input
              className={control('city')}
              value={value.city}
              onChange={(e) => set({ city: e.target.value })}
            />
          </label>
        ) : null}
        <label className="block min-w-0 text-sm sm:col-span-2">
          <span className={labelChrome[appearance]}>خیابان / محله</span>
          <textarea
            id={`${uid}-street`}
            className={cn(control('street'), 'min-h-[4.5rem] resize-y')}
            value={value.street}
            autoComplete="street-address"
            placeholder="مثال: بلوار سجاد، خیابان احمدآباد"
            onChange={(e) => set({ street: e.target.value })}
            aria-invalid={reveal && !!errors.street}
            aria-describedby={reveal && errors.street ? `${uid}-street-err` : `${uid}-street-hint`}
          />
          {reveal && errors.street ? (
            <span id={`${uid}-street-err`} className="mt-1 block text-xs text-red-600" role="alert">{errors.street}</span>
          ) : (
            <span id={`${uid}-street-hint`} className={cn('mt-1 block text-xs', muted[appearance])}>
              خیابان را بنویسید؛ پلاک و واحد را جداگانه پر کنید.
            </span>
          )}
        </label>
        <Field appearance={appearance} id={`${uid}-alley`} label="کوچه (اختیاری)">
          <input
            id={`${uid}-alley`}
            className={fieldClass}
            value={value.alley || ''}
            onChange={(e) => set({ alley: e.target.value })}
          />
        </Field>
        <Field appearance={appearance} id={`${uid}-plaque`} label="پلاک" error={reveal ? errors.plaque : undefined}>
          <input
            id={`${uid}-plaque`}
            className={control('plaque')}
            value={value.plaque || ''}
            inputMode="text"
            onChange={(e) => set({ plaque: e.target.value })}
          />
        </Field>
        <Field appearance={appearance} id={`${uid}-unit`} label="واحد">
          <input
            id={`${uid}-unit`}
            className={fieldClass}
            value={value.unit || ''}
            onChange={(e) => set({ unit: e.target.value })}
          />
        </Field>
        <Field
          appearance={appearance}
          id={`${uid}-postal`}
          label="کدپستی"
          hint={mode === 'torobpay' ? 'ترب‌پی بدون ۱۰ رقم، سفارش را نمی‌سازد' : 'برای پست پیشتاز بهتر است پر شود'}
          error={reveal ? errors.postalCode : undefined}
        >
          <span className="relative block min-w-0">
            <MapPin className={cn('pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2', muted[appearance])} aria-hidden />
            <input
              id={`${uid}-postal`}
              className={cn(control('postalCode'), 'pr-10 tracking-[0.18em]')}
              value={postalShown}
              inputMode="numeric"
              dir="ltr"
              autoComplete="postal-code"
              maxLength={10}
              onChange={(e) => set({ postalCode: postalDigits(e.target.value) })}
            />
          </span>
        </Field>
      </div>

      {mode === 'torobpay' ? (
        <ul className="grid gap-1.5 rounded-2xl border border-dashed border-current/10 bg-black/[0.02] px-3 py-3 text-xs sm:grid-cols-2">
          {checklist.map((row) => (
            <li key={row.id} className={cn('flex min-w-0 items-center gap-2', row.ok ? 'text-emerald-700' : muted[appearance])}>
              <span aria-hidden>{row.ok ? '✓' : '○'}</span>
              <span>{row.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Field({
  appearance,
  id,
  label,
  hint,
  error,
  children,
}: {
  appearance: CheckoutAppearance;
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className={labelChrome[appearance]}>{label}</span>
      {children}
      {error ? (
        <span id={`${id}-err`} className="mt-1 block text-xs text-red-600" role="alert">{error}</span>
      ) : hint ? (
        <span id={`${id}-hint`} className={cn('mt-1 block text-xs', muted[appearance])}>{hint}</span>
      ) : null}
    </label>
  );
}

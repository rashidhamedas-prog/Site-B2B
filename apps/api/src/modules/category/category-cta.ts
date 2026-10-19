import { BadRequestException } from '@nestjs/common';

/** Per-channel category CTA (retail = `cta`, wholesale = `wholesaleCta`). */
export type CategoryCtaDestination = 'listing' | 'custom';
export type CategoryCtaPlacement = 'below_intro' | 'below_bottom';
export type CategoryCtaVariant = 'primary' | 'secondary';

export type CategoryCta = {
  enabled: boolean;
  label: string;
  destination: CategoryCtaDestination;
  customUrl: string | null;
  placement: CategoryCtaPlacement;
  variant: CategoryCtaVariant;
};

export const CATEGORY_LISTING_HASH = '#category-listing';

const LABEL_MAX = 80;
const URL_MAX = 300;

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/** Allow same-page hash, site-relative path, or https URL. Reject unsafe schemes. */
export function sanitizeCategoryCtaUrl(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (value.length > URL_MAX) return null;
  if (/[\s"'()\\<>]/.test(value)) return null;
  if (/^(javascript|data|vbscript):/i.test(value)) return null;

  if (value.startsWith('#') && !value.startsWith('#/')) {
    if (value.length < 2 || /[\n\r]/.test(value)) return null;
    return value;
  }

  if (value.startsWith('/') && !value.startsWith('//')) {
    return value.slice(0, URL_MAX);
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return url.toString().slice(0, URL_MAX);
  } catch {
    return null;
  }
}

export function resolveCategoryCtaHref(cta: CategoryCta): string | null {
  if (!cta.enabled) return null;
  if (!cta.label.trim()) return null;
  if (cta.destination === 'listing') return CATEGORY_LISTING_HASH;
  return sanitizeCategoryCtaUrl(cta.customUrl);
}

/**
 * Normalize admin/API payload into a stored CTA object.
 * `null` → null (legacy rows stay disabled with no empty UI).
 * Invalid enabled config throws BadRequestException.
 */
export function normalizeCategoryCta(raw: unknown): CategoryCta | null {
  if (raw === null) return null;

  const src = asRecord(raw);
  if (!src) throw new BadRequestException('تنظیمات CTA نامعتبر است');

  const enabled = src.enabled === true;
  const label = String(src.label ?? '')
    .trim()
    .slice(0, LABEL_MAX);
  const destination: CategoryCtaDestination =
    src.destination === 'custom' ? 'custom' : 'listing';
  const placement: CategoryCtaPlacement =
    src.placement === 'below_bottom' ? 'below_bottom' : 'below_intro';
  const variant: CategoryCtaVariant =
    src.variant === 'secondary' ? 'secondary' : 'primary';

  let customUrl: string | null = null;
  if (destination === 'custom') {
    customUrl = sanitizeCategoryCtaUrl(src.customUrl);
  }

  const normalized: CategoryCta = {
    enabled,
    label,
    destination,
    customUrl,
    placement,
    variant,
  };

  if (!enabled) return normalized;

  if (!label) {
    throw new BadRequestException('متن دکمه CTA هنگام فعال بودن الزامی است');
  }
  if (destination === 'custom' && !customUrl) {
    throw new BadRequestException(
      'برای مقصد سفارشی، مسیر داخلی (/...) یا آدرس https معتبر وارد کنید',
    );
  }

  return normalized;
}

/** Form / UI default when column is null. Never auto-enables storefront CTA. */
export function defaultCategoryCta(): CategoryCta {
  return {
    enabled: false,
    label: '',
    destination: 'listing',
    customUrl: null,
    placement: 'below_intro',
    variant: 'primary',
  };
}

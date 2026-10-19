export type CategoryCtaDestination = 'listing' | 'custom';
export type CategoryCtaPlacement = 'below_intro' | 'below_bottom';
export type CategoryCtaVariant = 'primary' | 'secondary';

export type CategoryCtaConfig = {
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

export function defaultCategoryCta(): CategoryCtaConfig {
  return {
    enabled: false,
    label: '',
    destination: 'listing',
    customUrl: null,
    placement: 'below_intro',
    variant: 'primary',
  };
}

export function sanitizeCategoryCtaUrl(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value || value.length > URL_MAX) return null;
  if (/[\s"'()\\<>]/.test(value)) return null;
  if (/^(javascript|data|vbscript):/i.test(value)) return null;
  if (value.startsWith('#') && !value.startsWith('#/')) {
    return value.length >= 2 ? value : null;
  }
  if (value.startsWith('/') && !value.startsWith('//')) return value.slice(0, URL_MAX);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return url.toString().slice(0, URL_MAX);
  } catch {
    return null;
  }
}

/** Coerce API/admin payload for form editing; never enables by default. */
export function categoryCtaFromUnknown(raw: unknown): CategoryCtaConfig {
  const base = defaultCategoryCta();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const src = raw as Record<string, unknown>;
  const destination: CategoryCtaDestination =
    src.destination === 'custom' ? 'custom' : 'listing';
  return {
    enabled: src.enabled === true,
    label: String(src.label ?? '')
      .trim()
      .slice(0, LABEL_MAX),
    destination,
    customUrl: destination === 'custom' ? sanitizeCategoryCtaUrl(src.customUrl) : null,
    placement: src.placement === 'below_bottom' ? 'below_bottom' : 'below_intro',
    variant: src.variant === 'secondary' ? 'secondary' : 'primary',
  };
}

export function resolveCategoryCtaHref(cta: CategoryCtaConfig): string | null {
  if (!cta.enabled) return null;
  const label = cta.label.trim();
  if (!label) return null;
  if (cta.destination === 'listing') return CATEGORY_LISTING_HASH;
  return sanitizeCategoryCtaUrl(cta.customUrl);
}

/** Payload for PATCH — keep disabled configs so admin settings persist. */
export function serializeCategoryCta(cta: CategoryCtaConfig): CategoryCtaConfig {
  const destination: CategoryCtaDestination =
    cta.destination === 'custom' ? 'custom' : 'listing';
  return {
    enabled: cta.enabled === true,
    label: String(cta.label || '')
      .trim()
      .slice(0, LABEL_MAX),
    destination,
    customUrl: destination === 'custom' ? sanitizeCategoryCtaUrl(cta.customUrl) : null,
    placement: cta.placement === 'below_bottom' ? 'below_bottom' : 'below_intro',
    variant: cta.variant === 'secondary' ? 'secondary' : 'primary',
  };
}

import {
  irrToTomanOnce,
  pageUniqueForProduct,
  pageUniqueForVariant,
  PRODUCT_PAGE_UNIQUE_PREFIX,
  retailUnitStock,
  sanitizeGuarantee,
  selectDefaultRetailVariant,
  sortVariantsStable,
} from '@taranom/shared-types';
import { resolveChannelSale } from '../product/product-sale';
import { isPublishableImageUrl, MIN_TOROB_IMAGE_PX } from './torob-image';

export const TOROB_API_VERSION = 'torob_api_v3';
export const TOROB_PAGE_SIZE = 100;
export const RETAIL_CANONICAL_ORIGIN = 'https://www.poshaktaranom.ir';
export {
  irrToTomanOnce,
  pageUniqueForProduct,
  pageUniqueForVariant,
  PRODUCT_PAGE_UNIQUE_PREFIX,
  retailUnitStock,
  sanitizeGuarantee,
  selectDefaultRetailVariant,
  sortVariantsStable,
};

export type TorobSkipReason =
  | 'soft_deleted'
  | 'not_active'
  | 'hidden_retail'
  | 'invalid_retail_price'
  | 'missing_image'
  | 'image_not_absolute'
  | 'image_not_https'
  | 'image_thumbnail'
  | 'image_url_too_long'
  | 'image_too_small'
  | 'variant_missing';

export interface TorobProjectionSourceVariant {
  id: string;
  productId?: string;
  color?: string | null;
  size?: string | null;
  retailStock?: number | string | null;
  wholesaleStock?: number | string | null;
  stock?: number | string | null;
  imageUrl?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface TorobProjectionSourceProduct {
  id: string;
  sku?: string | null;
  slug?: string | null;
  name: string;
  description?: string | null;
  retailFullContent?: string | null;
  status?: string | null;
  showOnRetail?: boolean | null;
  deletedAt?: Date | string | null;
  retailPrice?: number | string | null;
  retailStock?: number | string | null;
  wholesaleStock?: number | string | null;
  stock?: number | string | null;
  images?: string[] | null;
  specs?: Record<string, unknown> | object | null;
  fabric?: string | null;
  guarantee?: string | null;
  defaultRetailVariantId?: string | null;
  category?: { name?: string | null } | null;
  variants?: TorobProjectionSourceVariant[] | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  wholesaleIsDiscounted?: boolean | null;
  retailIsDiscounted?: boolean | null;
  isDiscounted?: boolean | null;
  wholesaleDiscountType?: string | null;
  retailDiscountType?: string | null;
  discountType?: string | null;
  wholesaleDiscountPercent?: number | null;
  retailDiscountPercent?: number | null;
  discountPercent?: number | null;
  wholesaleDiscountAmount?: number | null;
  retailDiscountAmount?: number | null;
  discountAmount?: number | null;
  wholesaleDiscountStartsAt?: Date | string | null;
  retailDiscountStartsAt?: Date | string | null;
  discountStartsAt?: Date | string | null;
  wholesaleDiscountEndsAt?: Date | string | null;
  retailDiscountEndsAt?: Date | string | null;
  discountEndsAt?: Date | string | null;
  wholesalePrice?: number | string | null;
  retailCompareAtPrice?: number | string | null;
  wholesaleCompareAtPrice?: number | string | null;
}

export interface TorobProductPayload {
  page_unique: string;
  page_url: string;
  product_group_id: string;
  title: string;
  subtitle?: string;
  current_price: number;
  old_price?: number;
  availability: boolean;
  image_links: string[];
  short_desc?: string;
  spec: Record<string, string>;
  guarantee?: string;
  date_added: string;
  date_updated: string;
}

export interface TorobProjectionResult {
  publishable: boolean;
  skipReason?: TorobSkipReason;
  sku?: string | null;
  payload?: TorobProductPayload;
  selectedVariantId: string | null;
  productId: string;
}

export function retailProductOrigin(origin = RETAIL_CANONICAL_ORIGIN): string {
  return String(origin || RETAIL_CANONICAL_ORIGIN).replace(/\/$/, '');
}

export function retailPageUrl(slug: string, variantId?: string | null, origin = RETAIL_CANONICAL_ORIGIN): string {
  const path = `${retailProductOrigin(origin)}/products/${String(slug || '').replace(/^\/+|\/+$/g, '')}`;
  return variantId ? `${path}?variant=${encodeURIComponent(variantId)}` : path;
}

export function toIso8601(value?: Date | string | null): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date(0);
  if (Number.isNaN(date.getTime())) return new Date(0).toISOString();
  return date.toISOString();
}

export function maxUpdatedAt(...values: Array<Date | string | null | undefined>): string {
  let max = 0;
  for (const value of values) {
    if (!value) continue;
    const ts = new Date(value).getTime();
    if (Number.isFinite(ts) && ts > max) max = ts;
  }
  return new Date(max || 0).toISOString();
}

export function flattenSpec(specs?: Record<string, unknown> | null, extra?: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  if (specs && typeof specs === 'object') {
    for (const [key, value] of Object.entries(specs)) {
      if (value == null) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const text = String(value).trim();
        if (text) out[key] = text.slice(0, 500);
      }
    }
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value?.trim()) out[key] = value.trim().slice(0, 500);
    }
  }
  return out;
}

function absMedia(url: string | undefined, mediaOrigin: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url.replace(/^http:\/\//i, 'https://');
  const base = mediaOrigin.replace(/\/$/, '');
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/media/${url}`;
}

export function collectImageLinks(
  product: TorobProjectionSourceProduct,
  variant: TorobProjectionSourceVariant | null,
  mediaOrigin: string,
): { links: string[]; skipReason?: TorobSkipReason } {
  const candidates: string[] = [];
  if (variant?.imageUrl) candidates.push(absMedia(variant.imageUrl, mediaOrigin));
  for (const image of product.images || []) {
    const resolved = absMedia(image, mediaOrigin);
    if (resolved && !candidates.includes(resolved)) candidates.push(resolved);
  }
  const links: string[] = [];
  let firstFailure: TorobSkipReason | undefined;
  for (const url of candidates) {
    const check = isPublishableImageUrl(url);
    if (check.ok) {
      links.push(url.slice(0, 1000));
    } else if (!firstFailure) {
      firstFailure = check.reason;
    }
  }
  if (!links.length) return { links: [], skipReason: firstFailure || 'missing_image' };
  return { links };
}

function shortDesc(product: TorobProjectionSourceProduct): string | undefined {
  const raw = String(product.description || product.retailFullContent || '').replace(/<[^>]*>/g, '').trim();
  if (!raw) return undefined;
  return raw.slice(0, 500);
}

export function isRetailPublishableProduct(product: TorobProjectionSourceProduct): {
  ok: boolean;
  reason?: TorobSkipReason;
} {
  if (product.deletedAt) return { ok: false, reason: 'soft_deleted' };
  if (String(product.status || '').toUpperCase() !== 'ACTIVE') return { ok: false, reason: 'not_active' };
  if (product.showOnRetail === false) return { ok: false, reason: 'hidden_retail' };
  if (!(Number(product.retailPrice) > 0)) return { ok: false, reason: 'invalid_retail_price' };
  return { ok: true };
}

export function projectTorobOption(input: {
  product: TorobProjectionSourceProduct;
  variant?: TorobProjectionSourceVariant | null;
  mediaOrigin?: string;
  storeOrigin?: string;
}): TorobProjectionResult {
  const { product } = input;
  const storeOrigin = input.storeOrigin || RETAIL_CANONICAL_ORIGIN;
  const mediaOrigin = input.mediaOrigin || storeOrigin;
  const visibility = isRetailPublishableProduct(product);
  if (!visibility.ok) {
    return {
      publishable: false,
      skipReason: visibility.reason,
      sku: product.sku,
      selectedVariantId: input.variant?.id ?? null,
      productId: product.id,
    };
  }

  const variant = input.variant ?? null;
  if (variant && variant.productId && variant.productId !== product.id) {
    return {
      publishable: false,
      skipReason: 'variant_missing',
      sku: product.sku,
      selectedVariantId: variant.id,
      productId: product.id,
    };
  }

  const images = collectImageLinks(product, variant, mediaOrigin);
  if (!images.links.length) {
    return {
      publishable: false,
      skipReason: images.skipReason || 'missing_image',
      sku: product.sku,
      selectedVariantId: variant?.id ?? null,
      productId: product.id,
    };
  }

  const sale = resolveChannelSale(product as any, 'RETAIL');
  const currentPrice = irrToTomanOnce(sale.payable);
  const oldPriceToman =
    sale.active && sale.original != null ? irrToTomanOnce(sale.original) : undefined;
  const retailStock = retailUnitStock(variant ?? product);
  const slug = String(product.slug || product.id).replace(/^\/+|\/+$/g, '');
  const guarantee = sanitizeGuarantee(product.guarantee);
  const subtitle = variant
    ? [variant.color, variant.size].filter(Boolean).join(' / ') || undefined
    : undefined;

  const payload: TorobProductPayload = {
    page_unique: variant ? pageUniqueForVariant(variant.id) : pageUniqueForProduct(product.id),
    page_url: retailPageUrl(slug, variant?.id, storeOrigin),
    product_group_id: product.id,
    title: String(product.name || '').slice(0, 500),
    current_price: currentPrice,
    availability: retailStock > 0,
    image_links: images.links,
    spec: flattenSpec(product.specs as Record<string, unknown> | null, {
      fabric: product.fabric || undefined,
      color: variant?.color || undefined,
      size: variant?.size || undefined,
      category: product.category?.name || undefined,
    }),
    date_added: toIso8601(variant?.createdAt || product.createdAt),
    date_updated: maxUpdatedAt(product.updatedAt, product.createdAt, variant?.updatedAt, variant?.createdAt),
  };
  if (subtitle) payload.subtitle = subtitle.slice(0, 500);
  if (oldPriceToman != null && oldPriceToman > currentPrice) payload.old_price = oldPriceToman;
  const desc = shortDesc(product);
  if (desc) payload.short_desc = desc;
  if (guarantee) payload.guarantee = guarantee;

  return {
    publishable: true,
    sku: product.sku,
    payload,
    selectedVariantId: variant?.id ?? null,
    productId: product.id,
  };
}

export function enumeratePublishableOptions(
  product: TorobProjectionSourceProduct,
  mediaOrigin?: string,
  storeOrigin?: string,
): TorobProjectionResult[] {
  const variants = sortVariantsStable(product.variants || []);
  if (!variants.length) {
    return [projectTorobOption({ product, variant: null, mediaOrigin, storeOrigin })];
  }
  return variants.map((variant) => projectTorobOption({ product, variant, mediaOrigin, storeOrigin }));
}

export function projectSelectedPdpOption(
  product: TorobProjectionSourceProduct,
  requestedVariantId?: string | null,
  mediaOrigin?: string,
  storeOrigin?: string,
): TorobProjectionResult {
  const variants = product.variants || [];
  const requested = requestedVariantId
    ? variants.find((variant) => variant.id === requestedVariantId) ?? null
    : null;
  const selected =
    requested ||
    selectDefaultRetailVariant(variants, product.defaultRetailVariantId);
  return projectTorobOption({ product, variant: selected, mediaOrigin, storeOrigin });
}

export { MIN_TOROB_IMAGE_PX };

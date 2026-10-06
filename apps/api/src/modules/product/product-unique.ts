import { BadRequestException } from '@nestjs/common';
import { asciiSlug } from '../../common/ascii-slug';
import { normalizePublicSlug } from '../../common/public-slug';

export const PRODUCT_SKU_TAKEN = 'این SKU قبلاً برای کالای دیگری ثبت شده است';
export const PRODUCT_SLUG_TAKEN = 'این slug قبلاً استفاده شده است';
export const PRODUCT_UNIQUE_GENERIC = 'ثبت محصول به‌خاطر مقدار تکراری انجام نشد';

function uniqueDetail(err: unknown): {
  code?: string;
  detail: string;
  constraint: string;
  table: string;
} {
  const e = (err ?? {}) as {
    code?: string;
    detail?: string;
    constraint?: string;
    table?: string;
    driverError?: { code?: string; detail?: string; constraint?: string; table?: string };
  };
  const driver = e.driverError ?? {};
  return {
    code: e.code ?? driver.code,
    detail: String(e.detail ?? driver.detail ?? ''),
    constraint: String(e.constraint ?? driver.constraint ?? ''),
    table: String(e.table ?? driver.table ?? ''),
  };
}

/** Map Postgres unique_violation to a client error. Null means "not this case". */
export function productUniqueMessage(err: unknown): string | null {
  const { code, detail, constraint, table } = uniqueDetail(err);
  const blob = `${detail} ${constraint} ${table}`;
  if (
    code !== '23505' &&
    !/duplicate key value violates unique constraint/i.test(
      String((err as { message?: string })?.message ?? '')
    )
  ) {
    return null;
  }
  if (/\(sku\)/i.test(detail) || /sku/i.test(constraint)) {
    return PRODUCT_SKU_TAKEN;
  }
  if (/\(slug\)/i.test(detail) || /slug/i.test(constraint)) {
    return PRODUCT_SLUG_TAKEN;
  }
  if (
    code === '23505' ||
    /duplicate key/i.test(blob) ||
    /duplicate key/i.test(String((err as { message?: string })?.message ?? ''))
  ) {
    return PRODUCT_UNIQUE_GENERIC;
  }
  return null;
}

export function throwProductUniqueOrRethrow(err: unknown): never {
  const message = productUniqueMessage(err);
  if (message) throw new BadRequestException(message);
  throw err;
}

/**
 * Slug that `@BeforeInsert generateSlug` will persist.
 * Empty input follows the SKU, then Latin name, then Persian name.
 */
export function insertProductSlug(input: {
  slug?: string | null;
  sku?: string | null;
  nameEn?: string | null;
  name?: string | null;
}): string {
  const skuSlug = input.sku ? asciiSlug(String(input.sku), '') : '';
  const raw = String(input.slug || '').trim();
  if (!raw) {
    if (skuSlug) return skuSlug;
    if (input.nameEn) return asciiSlug(input.nameEn);
    if (input.name) return asciiSlug(input.name);
    return 'product';
  }
  return asciiSlug(normalizePublicSlug(raw), skuSlug || 'product');
}

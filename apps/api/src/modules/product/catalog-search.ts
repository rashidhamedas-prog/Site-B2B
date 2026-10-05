/**
 * Admin and storefront catalog text search.
 * The query string is only ever a bound parameter. SQL text is constant.
 */

const ALIAS_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Arabic yeh/kaf, Persian digits, Arabic-Indic digits → Persian letters and ASCII digits. */
export const CATALOG_FOLD_FROM = 'يك۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';
export const CATALOG_FOLD_TO = 'یک01234567890123456789';

const INVISIBLE_CLASS = '[\u200c\u200f\u200e\u202a\u202b\u202c\u202d\u202e]';

export const CATALOG_SEARCH_MAX = 80;

export function foldCatalogSearchText(raw: string | null | undefined): string {
  let s = String(raw ?? '');
  s = s.replace(/[\u200c\u200f\u200e\u202a-\u202e]/g, '');
  s = s.replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  s = s.replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));
  s = s.replace(/[\u06f0-\u06f9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
  s = s.replace(/\s+/g, ' ').trim();
  return s.slice(0, CATALOG_SEARCH_MAX);
}

/** LIKE pattern with `%` `_` `\` escaped. Null means "no text filter". */
export function catalogSearchLikePattern(raw: string | null | undefined): string | null {
  const folded = foldCatalogSearchText(raw);
  if (!folded) return null;
  const escaped = folded.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

/** Fold a SQL expression the same way as `foldCatalogSearchText`. */
export function catalogFoldSql(expr: string): string {
  return `regexp_replace(translate(${expr}, '${CATALOG_FOLD_FROM}', '${CATALOG_FOLD_TO}'), '${INVISIBLE_CLASS}', '', 'g')`;
}

/**
 * Matches name, current SKU, legacy fabric, the fabric shown in admin (`specs.fabricType`),
 * and previous SKUs kept in `product_sku_aliases`.
 */
export function catalogSearchPredicate(alias = 'p'): string {
  if (!ALIAS_RE.test(alias)) {
    throw new Error('catalog search alias must be a SQL identifier');
  }
  const fold = (expr: string) => catalogFoldSql(expr);
  return `(
    ${fold(`${alias}.name`)} ILIKE :catalogQ ESCAPE '\\'
    OR ${fold(`${alias}.sku`)} ILIKE :catalogQ ESCAPE '\\'
    OR ${fold(`COALESCE(${alias}.fabric, '')`)} ILIKE :catalogQ ESCAPE '\\'
    OR ${fold(`COALESCE(${alias}.specs->>'fabricType', '')`)} ILIKE :catalogQ ESCAPE '\\'
    OR EXISTS (
      SELECT 1 FROM product_sku_aliases a
      WHERE a."productId" = ${alias}.id
        AND ${fold('a.sku')} ILIKE :catalogQ ESCAPE '\\'
    )
  )`;
}

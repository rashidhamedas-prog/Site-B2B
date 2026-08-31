/** Static old descriptive wholesale product slugs → current code slugs.
 * Source: SEO-URL-INVENTORY.csv CANONICAL_MISMATCH rows (inventory 2026-08-11).
 */

/** old path segment → new path segment */
export const PRODUCT_SLUG_REDIRECTS: Readonly<Record<string, string>> = {
  'linen-sport-jacket-erika': 'coats00015',
  'linen-shirt-manteau-erika': 'linen-sport-jacket-erika',
  'bezayagh-jacket-rose': 'coats00014',
  'cotton-vest-pants-set-nazi': 'vests-pants00001',
  'jacquard-jacket-pardis': 'coats00013',
  'woolen-teddy-manteau-rasta': 'winter-wear00015',
  'woolen-kaftan-noora': 'kaftans00002',
  'کاپشن-بامبری-winter-wear00014': 'winter-wear00014',
  'linen-shirt-manteau-golrokh-blouses00016': 'blouses00016',
  'linen-embroidered-manteau-nastaran': 'blouses00015',
  'linen-pants-arsa': 'pants00006',
  'linen-pants-hasty': 'pants00005',
  'cotton-crop-jacket-aramis': 'coats00012',
  'chenille-coat-prima': 'coats00011',
  'cotton-tracksuit-set-tara': 'winter-wear00013',
  'teddy-hoodie-sweatshirt-good': 'winter-wear00012',
  'patterned-french-terry-shirt': 'winter-wear00011',
  'woolen-coat-maral': 'winter-wear00010',
  'footer-coat-arka': 'winter-wear00009',
  'chenille-coat-negin': 'coats00010',
  'lyocell-jacket-jacqueline': 'coats00009',
  'memory-lined-raincoat-110': 'winter-wear00008',
  'woolen-overcoat-athena': 'winter-wear00007',
  'chenille-coat-mahour': 'coats00008',
  'tetoron-basic-shirt-sahar': 'blouses00014',
  'wool-coat-katayoun': 'winter-wear00006',
  'footer-coat-dalia': 'winter-wear00005',
  'waterproof-memory-raincoat-110': 'winter-wear00004',
  'maserati-pants-mahin': 'pants00004',
  'crushed-footer-coat-tiara': 'winter-wear00003',
  'lined-memory-raincoat-80': 'winter-wear00002',
  'solid-memory-raincoat-80': 'winter-wear00001',
  'lyocell-baggy-pants-jacqueline': 'pants00003',
  'cotton-overcoat-laleh': 'coats00006',
  'kat-katan-freesize-kian': 'coats00005',
  'kat-katan-kajerah-alice': 'coats00004',
  'cotton-twill-manteau-mahan': 'coats00003',
  'cotton-twill-bomber-jacket-ghazal': 'coats00002',
  'cotton-twill-sport-jacket-dorsa': 'coats00001',
  'cotton-twill-skirt-suit-tanin': 'skirt-suits00001',
  'mom-style-cotton-pants': 'pants00002',
  'linen-shirt-manteau-sarinaz': 'blouses00013',
  'linen-shirt-manteau-minoo': 'blouses00012',
  'linen-pants-neda': 'pants00001',
  'linen-shirt-manteau-barana': 'blouses00011',
  'linen-shirt-manteau-niki': 'blouses00010',
  'linen-shirt-manteau-delin': 'blouses00009',
  'linen-vest-skirt-set-baran': 'vests-skirts00001',
  'linen-shirt-manteau-yaghoot': 'blouses00008',
  'linen-heart-shirt-manteau-behgol': 'blouses00007',
  'linen-bow-tie-shirt-manteau-behgol': 'blouses00006',
  'linen-butterfly-shirt-manteau-behgol': 'blouses00005',
  'linen-shirt-manteau-tina': 'blouses00004',
  'linen-shirt-manteau-zhinoos': 'blouses00003',
  'linen-kaftan-afagh': 'kaftans00001',
  'linen-shirt-manteau-abnous': 'blouses00002',
  'linen-shirt-manteau-nazgol': 'blouses00001',
};

/** Return target slug for an old product path segment, or null if none / noop. */
export function lookupProductSlugRedirect(slug: string): string | null {
  const target = PRODUCT_SLUG_REDIRECTS[slug];
  if (!target || target === slug) return null;
  return target;
}

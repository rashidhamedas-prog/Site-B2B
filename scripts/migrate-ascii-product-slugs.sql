-- ASCII product slugs (SKU-based) so copied URLs stay readable.
-- Legacy Persian URLs still resolve via API trailing-SKU fallback + 301 redirect.

UPDATE products
SET slug = lower(sku)
WHERE "deletedAt" IS NULL
  AND sku IS NOT NULL
  AND trim(sku) <> ''
  AND (
    slug IS NULL
    OR slug ~ '[^[:ascii:]]'
    OR slug <> lower(sku)
  );

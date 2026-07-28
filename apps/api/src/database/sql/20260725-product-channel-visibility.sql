-- Channel visibility + retail compare-at price (safe to re-run)
ALTER TABLE products ADD COLUMN IF NOT EXISTS "retailCompareAtPrice" bigint NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "showOnWholesale" boolean NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "showOnRetail" boolean NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "retailFeatured" boolean NOT NULL DEFAULT false;

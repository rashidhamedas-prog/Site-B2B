-- Product channel visibility flags (wholesale .com / retail .ir)
-- Safe to re-run.

ALTER TABLE products ADD COLUMN IF NOT EXISTS "showOnWholesale" boolean NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "showOnRetail" boolean NOT NULL DEFAULT true;

UPDATE products SET "showOnWholesale" = true WHERE "showOnWholesale" IS NULL;
UPDATE products SET "showOnRetail" = true WHERE "showOnRetail" IS NULL;

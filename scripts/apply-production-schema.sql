-- ============================================================================
-- Taranom B2B — idempotent production schema safety-net
-- Mirrors migration 20260717-001-product-specs-discounts-shipping.
-- Safe to run repeatedly; used by the deploy workflow in case the TypeORM
-- migrations were skipped. Keep this in sync with the entities/migration.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- products: relax fabric, add specs / sizeType / isDiscounted
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'fabric'
  ) THEN
    ALTER TABLE products ALTER COLUMN fabric DROP NOT NULL;
    ALTER TABLE products ALTER COLUMN fabric SET DEFAULT '';
  END IF;
END $$;

ALTER TABLE products ADD COLUMN IF NOT EXISTS "specs" jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "sizeType" varchar NOT NULL DEFAULT 'FREE';
ALTER TABLE products ADD COLUMN IF NOT EXISTS "isDiscounted" boolean NOT NULL DEFAULT false;

-- product_spec_memory
CREATE TABLE IF NOT EXISTS product_spec_memory (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  "fieldKey" varchar NOT NULL,
  value varchar NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_product_spec_memory_id" PRIMARY KEY (id),
  CONSTRAINT "UQ_product_spec_memory_field_value" UNIQUE ("fieldKey", value)
);
CREATE INDEX IF NOT EXISTS "IDX_product_spec_memory_fieldKey"
  ON product_spec_memory ("fieldKey");

-- discount_codes: scheduled start
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP;

-- tiered_discounts
CREATE TABLE IF NOT EXISTS tiered_discounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  levels jsonb NOT NULL DEFAULT '[]',
  "expiresAt" TIMESTAMP,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_tiered_discounts_id" PRIMARY KEY (id)
);

-- side_discounts
CREATE TABLE IF NOT EXISTS side_discounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  type varchar NOT NULL,
  percent integer NOT NULL,
  threshold bigint NOT NULL DEFAULT 0,
  "categoryId" uuid,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_side_discounts_id" PRIMARY KEY (id)
);

-- orders: freight & shipping fees
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "freightCost" bigint NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "freightReceiptUrl" varchar;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "intraCityFee" bigint NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "perKgFee" bigint NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "freeShipping" boolean NOT NULL DEFAULT false;

-- invoices: shipping fees
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "intraCityFee" bigint NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "perKgFee" bigint NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "freeShipping" boolean NOT NULL DEFAULT false;

-- products: product-level stock (independent of color variants)
ALTER TABLE products ADD COLUMN IF NOT EXISTS "stock" integer NOT NULL DEFAULT 0;

-- Backfill product stock from legacy per-variant totals when still zero
UPDATE products p
SET "stock" = COALESCE((
  SELECT SUM(v."stock")::int FROM product_variants v WHERE v."productId" = p."id"
), 0)
WHERE COALESCE(p."stock", 0) = 0
  AND EXISTS (SELECT 1 FROM product_variants v WHERE v."productId" = p."id");

-- inventory_movements: allow product-level movements without a variant
ALTER TABLE inventory_movements ALTER COLUMN "productVariantId" DROP NOT NULL;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS "productId" uuid;

-- Channel split: dual stock, warehouses.channel, CMS/site content, content channel fields
-- Safe to re-run.

-- 1) Product + variant dual stock
ALTER TABLE products ADD COLUMN IF NOT EXISTS "wholesaleStock" integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "retailStock" integer NOT NULL DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS "wholesaleStock" integer NOT NULL DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS "retailStock" integer NOT NULL DEFAULT 0;

-- Seed from legacy stock where new cols are still 0
UPDATE products
SET "wholesaleStock" = COALESCE(stock, 0)
WHERE COALESCE("wholesaleStock", 0) = 0 AND COALESCE(stock, 0) > 0;

UPDATE product_variants
SET "wholesaleStock" = COALESCE(stock, 0)
WHERE COALESCE("wholesaleStock", 0) = 0 AND COALESCE(stock, 0) > 0;

-- 2) Warehouses: add channel + seed retail/wholesale defaults
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS channel varchar NOT NULL DEFAULT 'WHOLESALE';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS notes text NULL;

UPDATE warehouses SET channel = 'WHOLESALE' WHERE channel IS NULL OR channel = '';

INSERT INTO warehouses (id, code, name, channel, "isActive", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'WHOLESALE', 'انبار عمده', 'WHOLESALE', true, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE channel = 'WHOLESALE' AND code IN ('WHOLESALE','MAIN'));

INSERT INTO warehouses (id, code, name, channel, "isActive", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'RETAIL', 'انبار تکی', 'RETAIL', true, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE channel = 'RETAIL');

-- If MAIN exists without retail twin, keep MAIN as wholesale default
UPDATE warehouses SET channel = 'WHOLESALE', "isDefault" = true
WHERE code = 'MAIN' AND channel = 'WHOLESALE';

-- 3) Inventory movements channel
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS channel varchar NOT NULL DEFAULT 'WHOLESALE';
UPDATE inventory_movements SET channel = 'WHOLESALE' WHERE channel IS NULL OR channel = '';

-- 4) CMS pages
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS channel varchar NOT NULL DEFAULT 'WHOLESALE';
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Drop old unique on slug alone if present; enforce (slug, channel)
DO $$ BEGIN
  ALTER TABLE cms_pages DROP CONSTRAINT IF EXISTS "UQ_cms_pages_slug";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  -- common typeorm unique name patterns
  ALTER TABLE cms_pages DROP CONSTRAINT IF EXISTS "UQ_a0b0c0d0e0f0";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Find and drop unique constraints that only cover slug
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'cms_pages' AND c.contype = 'u'
  LOOP
    -- drop all unique constraints; recreate composite below
    EXECUTE format('ALTER TABLE cms_pages DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS cms_pages_slug_channel_uidx ON cms_pages (slug, channel);

-- 5) Blog / collections / discounts channel
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS channel varchar NOT NULL DEFAULT 'WHOLESALE';
ALTER TABLE collections ADD COLUMN IF NOT EXISTS channel varchar NOT NULL DEFAULT 'WHOLESALE';
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS channel varchar NOT NULL DEFAULT 'WHOLESALE';

-- 6) Site contents table
CREATE TABLE IF NOT EXISTS site_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel varchar NOT NULL,
  "pageKey" varchar NOT NULL,
  title varchar NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo jsonb NULL,
  "isPublished" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_contents_channel_pagekey_uidx ON site_contents (channel, "pageKey");
CREATE INDEX IF NOT EXISTS site_contents_channel_idx ON site_contents (channel);
CREATE INDEX IF NOT EXISTS site_contents_pagekey_idx ON site_contents ("pageKey");

-- Wholesale color selection + min colors on products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS "allowWholesaleColorSelect" boolean NOT NULL DEFAULT false;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS "minWholesaleColors" integer NOT NULL DEFAULT 1;

-- Optional: retail shipping weight factor (stored in app_settings JSON key=shipping)
-- Example merge (manual): UPDATE app_settings SET value = value || '{"kgPerPiece": 0.45}'::jsonb WHERE key = 'shipping';

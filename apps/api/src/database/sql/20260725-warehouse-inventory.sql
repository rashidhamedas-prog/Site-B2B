-- Warehouse + reorder point + movement warehouse link (safe to re-run)
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  address text NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "isDefault" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO warehouses (id, code, name, address, "isActive", "isDefault")
SELECT gen_random_uuid(), 'MAIN', 'انبار اصلی', NULL, true, true
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE "isDefault" = true);

ALTER TABLE products ADD COLUMN IF NOT EXISTS "minStock" integer NOT NULL DEFAULT 10;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS "minStock" integer NULL;

ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS "warehouseId" uuid NULL;
DO $$ BEGIN
  ALTER TABLE inventory_movements
    ADD CONSTRAINT inventory_movements_warehouse_fk
    FOREIGN KEY ("warehouseId") REFERENCES warehouses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Retail B2C completion schema (TypeORM entities already defined; apply on production)
-- Safe / idempotent

CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  slug varchar NOT NULL UNIQUE,
  season varchar NULL,
  description text NULL,
  "imageUrl" varchar NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMPTZ NULL
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS "collectionId" varchar NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "isPreOrder" boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "preOrderDate" TIMESTAMPTZ NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "modelInfo" text NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "videoUrl" text NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS "affiliateId" varchar NULL;
-- shippingAddress may already exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "shippingAddress" text NULL;

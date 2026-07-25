-- Soft-void / reversal columns for orders (safe to re-run)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "walletApplied" bigint NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "discountCodeId" varchar NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "voidedAt" timestamptz NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "voidReason" text NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "effectsReversedAt" timestamptz NULL;

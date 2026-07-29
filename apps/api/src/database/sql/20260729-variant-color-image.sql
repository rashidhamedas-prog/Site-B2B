-- Per-color product image + order item image snapshot
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS "imageUrl" varchar NULL;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS "imageUrl" varchar NULL;

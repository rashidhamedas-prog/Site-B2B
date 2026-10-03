-- Restore two captured retail orders that were voided+purged after DigiPay/TorobPay
-- capture (2026-10-02 21:03Z / 21:17Z). Idempotent on order id PK.

BEGIN;

INSERT INTO orders (
  id, "orderNumber", "customerId", type, status, subtotal, discount, "shippingFee", total,
  "paymentMethod", "shippingMethod", "shippingAddress", notes, "createdAt", "updatedAt"
) VALUES
(
  '11c9fbdf-a241-4387-abd0-259d8f0e616c',
  'ORD-2026-00008-A6D7F8',
  'ab996453-b05c-4a31-ae3b-bbcd126c272c',
  'RETAIL_WEBSITE',
  'AWAITING_PAYMENT',
  21200000, 0, 0, 21200000,
  'ONLINE', 'PISHTAZ',
  '{"recipient":"خریدار ترنم","mobile":"09307986215","province":"تهران","city":"تهران","street":"آدرس کامل پس از هماهنگی با مشتری — بازیابی سفارش پرداخت‌شده دیجی‌پی","postalCode":""}',
  'بازیابی خودکار: پرداخت دیجی‌پی PAID ref 3655439561790974982580 پس از حذف ادمین در 2026-10-02 23:44Z',
  '2026-10-02 21:02:01+00',
  NOW()
),
(
  'abef7c7d-8035-425a-a7f6-1b9cbd476c27',
  'ORD-2026-00009-7462DE',
  'ab996453-b05c-4a31-ae3b-bbcd126c272c',
  'RETAIL_WEBSITE',
  'AWAITING_PAYMENT',
  12800000, 0, 0, 12800000,
  'ONLINE', 'PISHTAZ',
  '{"recipient":"خریدار ترنم","mobile":"09307986215","province":"تهران","city":"تهران","street":"آدرس کامل پس از هماهنگی با مشتری — بازیابی سفارش پرداخت‌شده ترب‌پی","postalCode":""}',
  'بازیابی خودکار: پرداخت ترب‌پی PAID پس از حذف ادمین در 2026-10-02 23:44Z',
  '2026-10-02 21:17:01+00',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (
  id, "orderId", "productVariantId", "productName", sku, color, size, quantity, "unitPrice", "totalPrice", "createdAt"
) VALUES
(
  'c8a6e008-a6d7-4f8a-9b01-11c9fbdf0001',
  '11c9fbdf-a241-4387-abd0-259d8f0e616c',
  'bc4324a5-9da9-4585-8846-63f4944a17a0',
  'اورکت کتان لاله',
  '7141',
  'قهوه ای سوخته',
  'سایز ۱',
  1, 21200000, 21200000,
  '2026-10-02 21:02:01+00'
),
(
  'c8a6e009-7462-4de0-9b02-abef7c7d0001',
  'abef7c7d-8035-425a-a7f6-1b9cbd476c27',
  '11e040fc-37b9-4335-87bd-f6106ecdc0c8',
  'اورکت پشمی مدل آتنا',
  'WINTER-WEAR00007',
  'کرمی',
  'سایز ۲',
  1, 12800000, 12800000,
  '2026-10-02 21:17:01+00'
)
ON CONFLICT (id) DO NOTHING;

UPDATE payments
SET "orderId" = '11c9fbdf-a241-4387-abd0-259d8f0e616c'
WHERE id = '8619b24c-4320-4795-be91-e68db420f187'
  AND status = 'PAID'
  AND ("orderId" IS NULL OR "orderId" = '');

UPDATE payments
SET "orderId" = 'abef7c7d-8035-425a-a7f6-1b9cbd476c27'
WHERE id = '1e8667c9-d8bc-4db6-b044-b0699de18f96'
  AND status = 'PAID'
  AND ("orderId" IS NULL OR "orderId" = '');

UPDATE payment_ledger_entries
SET "orderId" = '11c9fbdf-a241-4387-abd0-259d8f0e616c'
WHERE "paymentId" = '8619b24c-4320-4795-be91-e68db420f187'
  AND "orderId" IS NULL;

UPDATE payment_ledger_entries
SET "orderId" = 'abef7c7d-8035-425a-a7f6-1b9cbd476c27'
WHERE "paymentId" = '1e8667c9-d8bc-4db6-b044-b0699de18f96'
  AND "orderId" IS NULL;

UPDATE orders
SET status = 'PENDING_REVIEW', "stockCommittedAt" = COALESCE("stockCommittedAt", NOW()), "updatedAt" = NOW()
WHERE id IN (
  '11c9fbdf-a241-4387-abd0-259d8f0e616c',
  'abef7c7d-8035-425a-a7f6-1b9cbd476c27'
)
AND status = 'AWAITING_PAYMENT';

INSERT INTO inventory_movements (
  id, "productVariantId", type, quantity, "balanceAfter", "referenceId", "referenceType", notes, "productId", channel, "createdAt"
)
SELECT gen_random_uuid(), v.id, 'SALE', 1, GREATEST(0, v."retailStock" - 1), o.id, 'ORDER',
       'فروش سفارش ' || o."orderNumber" || ' (بازیابی پرداخت)', v."productId", 'RETAIL', NOW()
FROM orders o
JOIN order_items oi ON oi."orderId"::text = o.id::text
JOIN product_variants v ON v.id::text = oi."productVariantId"::text
WHERE o.id IN (
  '11c9fbdf-a241-4387-abd0-259d8f0e616c',
  'abef7c7d-8035-425a-a7f6-1b9cbd476c27'
)
AND NOT EXISTS (
  SELECT 1 FROM inventory_movements m
  WHERE m."referenceId"::text = o.id::text AND m.type = 'SALE' AND m.notes LIKE '%بازیابی%'
);

UPDATE product_variants v
SET "retailStock" = GREATEST(0, v."retailStock" - 1), "updatedAt" = NOW()
FROM order_items oi
WHERE oi."productVariantId"::text = v.id::text
  AND oi."orderId" IN (
    '11c9fbdf-a241-4387-abd0-259d8f0e616c',
    'abef7c7d-8035-425a-a7f6-1b9cbd476c27'
  )
  AND EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id::text = oi."orderId"::text AND o."stockCommittedAt" IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM inventory_movements m
    WHERE m."referenceId"::text = oi."orderId"::text AND m.type = 'SALE' AND m.notes LIKE '%بازیابی%'
    AND m."createdAt" < NOW() - interval '1 second'
  );

COMMIT;

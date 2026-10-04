-- Fix mojibake left by a non-UTF8 pipe of restore SQL (product lines already
-- repaired from catalog). Re-apply intended shipping/notes placeholders.
\encoding UTF8

BEGIN;

UPDATE orders
SET
  "shippingAddress" = '{"recipient":"خریدار ترنم","mobile":"09307986215","province":"تهران","city":"تهران","street":"آدرس کامل پس از هماهنگی با مشتری — بازیابی سفارش پرداخت‌شده دیجی‌پی","postalCode":""}',
  notes = 'بازیابی خودکار: پرداخت دیجی‌پی PAID پس از حذف ادمین در 2026-10-02 23:44Z؛ آدرس خیابان نیازمند تأیید تلفنی'
WHERE id = '11c9fbdf-a241-4387-abd0-259d8f0e616c';

UPDATE orders
SET
  "shippingAddress" = '{"recipient":"خریدار ترنم","mobile":"09307986215","province":"تهران","city":"تهران","street":"آدرس کامل پس از هماهنگی با مشتری — بازیابی سفارش پرداخت‌شده ترب‌پی","postalCode":""}',
  notes = 'بازیابی خودکار: پرداخت ترب‌پی PAID پس از حذف ادمین در 2026-10-02 23:44Z؛ آدرس خیابان نیازمند تأیید تلفنی'
WHERE id = 'abef7c7d-8035-425a-a7f6-1b9cbd476c27';

SELECT o."orderNumber", o.status, oi."productName", oi.color, oi.size, left(o."shippingAddress", 80) AS addr
FROM orders o
JOIN order_items oi ON oi."orderId"::text = o.id::text
WHERE o."orderNumber" IN ('ORD-2026-00008-A6D7F8','ORD-2026-00009-7462DE');

COMMIT;

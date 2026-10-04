-- Read-only reconciliation. Do not run as a migration. Do not UPDATE/DELETE.
-- Historical rows with no commission snapshot are marked for manual review.

SELECT 'orders_with_partner' AS report, COUNT(*)::int AS n
FROM orders
WHERE "salesPartnerId" IS NOT NULL;

SELECT 'orders_missing_snapshot' AS report, o.id, o."orderNumber", o.status, o."createdAt"
FROM orders o
WHERE o."salesPartnerId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sales_commission_snapshots s WHERE s."orderId" = o.id
  )
ORDER BY o."createdAt" ASC;

SELECT 'inflight_non_zarinpal' AS report, p.id, p."orderId", p.gateway, p.status, p."createdAt"
FROM payments p
WHERE p.status = 'PENDING'
  AND UPPER(COALESCE(p.gateway, '')) IN ('DIGIPAY', 'TOROBPAY')
ORDER BY p."createdAt" ASC;

SELECT 'payout_duplicate_bank_reference' AS report, "bankReference", COUNT(*)::int AS n
FROM sales_partner_payouts
WHERE "bankReference" IS NOT NULL AND "bankReference" <> ''
GROUP BY "bankReference"
HAVING COUNT(*) > 1;

SELECT 'ledger_rows' AS report, COUNT(*)::int AS n FROM sales_commission_ledger_entries;
SELECT 'payout_rows' AS report, COUNT(*)::int AS n FROM sales_partner_payouts;

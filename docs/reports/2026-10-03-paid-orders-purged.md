# Incident: DigiPay + TorobPay captured, orders missing

Date: 2026-10-03 (purchases 2026-10-03 00:33–00:47 IRST)

## What happened

Customer `09307986215` (خریدار ترنم) paid two retail checkouts:

| Time IRST | Gateway | Amount | Product | Order |
|---|---|---|---|---|
| 00:33 | DigiPay | 2,120,000 تومان | اورکت کتان لاله (سایز ۱، قهوه‌ای سوخته) | ORD-2026-00008-A6D7F8 |
| 00:47 | TorobPay | 1,280,000 تومان | اورکت پشمی مدل آتنا (سایز ۲، کرمی) | ORD-2026-00009-7462DE |

PSP capture and `applyCapturedPayment` both succeeded (`PENDING_REVIEW`, SALE movements, CAPTURE ledger). Shopper-facing SMS for `order.created` died with `uuid = character varying` on customer lookup.

At **03:14 IRST** (`2026-10-02 23:44Z`) both paid orders were **voided**: stock RETURN, status DELETED. A later **purge** hard-deleted the rows and nulled `payments.orderId`, so admin «سفارش‌ها» looked empty.

## Root causes

1. Admin void/purge allowed on orders with `PAID` gateway payments (money kept, fulfillment destroyed).
2. Purge set `payments.orderId = NULL`, hiding the financial link.
3. Browser-only `/payments/verify` (no server capture on PSP return) — not the failure this night, still a hole.
4. Outbox worker `customers.id` (uuid) vs `orders.customerId` (varchar).

## Fix

- Refuse void/purge when any linked payment is PAID/REFUNDED.
- Do not detach captured payments on purge.
- Hide delete controls for captured rows in admin list/detail.
- Server-side verify on DigiPay/TorobPay callback routes before UI redirect.
- Cast uuid/text in order row lock and outbox customer/order lookup.
- Restore the two orders with original ids and relink payments (`scripts/restore-20261002-paid-orphan-orders.sql`), then re-apply capture (stock + PENDING_REVIEW).

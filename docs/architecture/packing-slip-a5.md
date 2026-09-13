# A5 packing slip + parcel label (admin)

TASK-20260913-003. Admin-only print surface for warehouse packing and the outbound Iran-post sticker. Not a storefront change.

## 1. Goals, non-goals, assumptions

**Goal:** On a confirmed retail/wholesale order, the operator sees a full packing + shipping sheet, then prints one A5 page to stick on the parcel (and use as the pick checklist).

**Non-goals:** Post API / barcode / GNAF lookup, thermal 100×100 printers, gift-hide-prices mode, Adobe Experience Cloud / React Spectrum, new Nest endpoints, tax invoice legal form, changing order status on print.

**Confirmed (repo + industry patterns, not invented analytics):**

- Admin list `AdminOrders` labels `CONFIRMED` as «تأیید شده». List payload has no `shippingAddress`; `GET /orders/:id` (admin JWT) returns items, customer, and stored address.
- Address is a JSON string of structured fields or a free-form line (`shipping-address.ts` — read-only here; claimed by TASK-20260913-002).
- Public sender: `GET /v1/settings/public` → `business.businessName`, `phone`, `officeAddress || address`. No dedicated sender postal field.
- International packing slips (Shopify/ShipStation-style): ship-from, ship-to, order #, SKU/qty. Prices are often omitted for gifts. This shop asked for invoice amounts, so money stays in a secondary block.
- Iran A5-P / پست: گیرنده ~70٪، فرستنده ~30٪، کدپستی ۱۰خانه‌ای درشت، کنتراست بالا، بدون گرادیان.

**Assumptions:**

- Operators print from desktop Chrome/Edge to A5 paper (or A4 with printer “A5” setting).
- Default Mashhad city in `emptyShippingAddress` must not appear on free-form addresses that never stored city.
- Reprint after `PROCESSING` / `SHIPPED` / `DELIVERED` / `COMPLETED` is useful; unpaid / review / cancelled is not packing.

**Success criteria:**

- Preview first, then «چاپ A5».
- Recipient name, phone, address, 10 postal boxes are the largest block.
- One A5 portrait page for typical clothing orders (2–8 lines). Overflow can paginate.
- No extra JS on storefront landing pages.

## 2. System context

Actors: admin picker/packer, Nest order API, public business settings.

Trust boundary: existing admin JWT. Print runs in the same admin tab (no token in a new HTML document). Customer PII is intended on the physical label; do not `innerHTML` / `document.write` address fields (XSS). Do not log street+postal+mobile together.

Primary journey:

1. `/admin/orders` filter «تأیید شده» → printer icon → preview → چاپ A5 → tape on bag.
2. `/admin/orders/:id` labeled «برگه بسته» for the same sheet.

## 3. Modules and ownership

| Piece | Owner | Notes |
| --- | --- | --- |
| `packing-slip.ts` | web lib | Parse address, toman, labels, postal boxes |
| `AdminPackingSlip.tsx` | admin UI | Modal preview + `window.print` |
| `packing-slip.css` | print CSS | `@page A5`, hide chrome |
| Settings public | existing API | Sender; no schema change |
| `GET /orders/:id` | existing API | Admin already authorized |

Adobe App Builder scaffolder does not apply (this is Next admin, not ExC Shell).

## 4. Data

No new tables. Read-only projection:

- Order: number, dates, channel, ship/pay method, tracking, notes, money, items (name, sku, color, size, qty, prices).
- Recipient: structured JSON or free-form street; fallback customer name/phone/city.
- Sender: public business settings. Postal only if a real 10-digit code exists in the address (never a `09…` mobile).

Sensitive: recipient phone, street, postal. Retention = existing order row.

## 5. API / events

No new routes. Client:

```
GET /v1/orders/:id          Authorization: Bearer admin
GET /v1/settings/public     cacheable; module-cached after first open
```

Print is not an event. Status does not change.

## 6. Security

- Authorization stays on the server (`order.controller` admin vs customer).
- React text nodes only for PII.
- Print stylesheet hides the rest of the admin chrome; token stays in memory, not copied into a blob URL.
- Missing postal/phone/address: on-screen warning, still printable (operator may fix then reprint).

## 7. Deployment / ops

Admin-only CSS+JS. Storefront TTFB/LCP unchanged. Rollback = revert the web deploy. No migration.

## 8. Sequence

```
operator click → parallel GET order + public settings
              → buildPackingSlip
              → modal preview
              → print → html.packing-slip-print → @page A5 → afterprint cleanup
```

## 9. Tests and rollout

- Unit: `packing-slip.spec.ts` (JSON/free-form, postal vs mobile, status gate, toman).
- `apps/web` `tsc --noEmit`.
- Manual: open CONFIRMED row, preview, print dialog size A5.
- Rollout: merge to `master`, auto-deploy web. No canary flag (admin-only).

## 10. Decisions / open

- Confirmed: one combined A5 (label + checklist + invoice), not two sheets.
- Confirmed: show prices (shop request).
- Confirmed: `business.postalCode` in admin settings + public subset; packing slip prefers it over scraping the address line.
- Open: 100×150mm thermal later — do not block A5.

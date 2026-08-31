# Omnichannel Phase 0 — correctness gate

Date: 2026-08-26  
Task: TASK-20260826-001  
Branch: `ai/TASK-20260826-001-omnichannel-phase-0`  
Source: `OMNICHANNEL-INFRASTRUCTURE-RETAIL-WHOLESALE.md`

## Scope

Phase 0 only. No omnichannel schema, worker, or Telegram/Bale/Rubika adapters.

## Changes

- Shared `channel-product-projection` is the only Retail/Wholesale stock+visibility selector for Feed and Basalam. Legacy `stock` is ignored.
- `updateVariantStock` / `syncProductStockFromVariants` / `setProductStock` / `updateProductStock` accept the same `EntityManager`.
- Inventory adjust/set write stock and movement in one transaction. Checkout writes a `SALE` movement inside the existing order transaction. Cancel/void writes `RETURN`.
- Movement history is immutable. DELETE `/inventory/movements/:id` creates a `REVERSAL` and restores stock.
- `ReturnRequestAuditEntity` is on the runtime TypeORM entity list.
- Public `GET /products` allows only `ACTIVE`. Admin list is guarded `GET /products/admin`.
- CMS create/update sanitizes HTML; public slug/kind lookup always uses a channel (default WHOLESALE). No other-channel fallback.
- `StorageService.deleteByUrls` throws on real object-storage failures; missing objects stay idempotent.

## Tests

- `channel-product-projection.spec.ts` — Retail Feed/Basalam isolation (legacy `stock` ignored)
- `channel-stock-deduct.spec.ts` — last-unit race: second deduct is OVERSELL
- `public-product-status.spec.ts` — public rejects ALL/DRAFT
- `cms-sanitize.spec.ts` — script/onerror/javascript: discarded
- `inventory-movement.policy.spec.ts` — SALE ledger + ORDER/RMA cannot reverse from inventory UI
- `storage-delete.spec.ts` — real delete failures propagate
- `rma-channel.spec.ts` / `rma-audit-runtime.spec.ts` — channel restore + audit entity on runtime TypeORM

## Residual closed 2026-08-29

- RMA approve no longer writes legacy `product_variants.stock`. It restores `retailStock`/`wholesaleStock` via `updateVariantStock` in the same transaction and writes a `RETURN` movement.
- Product image URLs stay on the row until `deleteByUrls` succeeds (delete-first).

## Security review (branch diff)

Independent review found three medium issues; all were fixed in this task:

- Public CMS reads now sanitize `content`/`blocks` so legacy stored XSS is not served.
- Admin order line-qty edits write stock + movement in one transaction.
- `REVERSAL` of ORDER-linked SALE/RETURN is rejected; cancel/void is the only order restore path.

## Non-goals

- Phase 1+ tables, outbox, worker, connectors
- Production deploy
- Invented Bale/Rubika APIs

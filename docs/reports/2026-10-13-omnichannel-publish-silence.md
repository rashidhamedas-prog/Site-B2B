# Omnichannel publish silence — RCA + fix (2026-10-13)

## Symptom

کانال انتشار پست جدید نمی‌فرستاد؛ `sentToday = 0`، صف `publication.deliver.requested` خالی، از ۱۰ اکتبر فقط DELETE.

## Live evidence (VPS)

- Flags: `OMNICHANNEL_CONNECTORS_ENABLED=true`, `OMNICHANNEL_AUTO_PUBLISH=true`
- Workers healthy; Telegram WHOLESALE destination verified `canPost=true`
- Mode `LIVE`; OOS wholesale `DELETE`; quiet hours 23→12 Tehran
- Publications: ~170 DRAFT + ~308 WITHDRAWN; **zero READY**
- Product outbox after 10 Oct: almost only `product.stock_changed`
- Sample product: WITHDRAWN @ 10 Oct 00:00 → orphan DRAFT @ 00:03 → later stock ticks, no CREATE

## Root causes

1. **Category / manual requeue silent skip** — `enqueueCategoryProduct` returned early if *any* WITHDRAWN sibling existed, so after mass withdraw the admin blast queued 0 forever.
2. **Orphan DRAFT + `stock_only`** — first reopen saved DRAFT but CREATE never landed; later `stock_changed` used `localAction=update` → permanent `stock_only`.
3. **Latest-row lookup** — multiple publication versions per source×channel; `findOne` was unsafe; sync/manual now take newest by `updatedAt`.
4. **Worker silent ACK** — missing destination/connection returned without throw → outbox DONE with no post (fixed to fail before adapter).

## Fix (CODE)

- `publication-automation.ts`: orphan heal CREATE on stock under OOS DELETE when DRAFT/READY has no live remote message
- `omnichannel.service.ts`: requeue + manual publish reopen newest row; remove WITHDRAWN early-return
- `outbox-worker.service.ts`: throw on missing dest/conn before adapter call

## Owner ops after deploy

1. Hard-refresh `/admin/omnichannel`
2. One dry-run category requeue, then live confirm for a small allowlisted category
3. Or wait for next inventory `stock_changed` on orphan WHOLESALE drafts (heal path)
4. Do not flip connector flags (already on)

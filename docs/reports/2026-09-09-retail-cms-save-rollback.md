# Retail CMS save silently rolled back (2026-09-09)

## Symptom

On `/admin/site-content?channel=RETAIL`, switching «محصولات برتر» from manual to auto and pressing «ذخیره روی سایت تکی» snapped the UI straight back to the manual list. `.ir` home never changed.

## Evidence

- nginx: `PUT /api/v1/cms/admin/site-content?channel=RETAIL` → 200 (2076 B, new body) followed by `GET …/RETAIL/home` → 200 (**1891 B, always the old body**).
- `site_contents` RETAIL/home `updatedAt` = `2026-09-08 14:22:09.333` (epoch `1788877329333`) never moved; WHOLESALE/home frozen at 15:32:57 the same day.
- `omnichannel_outbox_events` contains `668b9336…:site:1788877329333:cms.published:…:RETAIL` — the dedupe key every later save tried to insert again.

## Root cause

`upsertSiteContent` ran `save(row)` and `outbox.enqueue(...)` inside one transaction. The outbox dedupe key was built from the row's **previous** `updatedAt`. One no-op save (nothing changed → TypeORM issued no UPDATE → `updatedAt` unchanged) consumed the key; every subsequent save produced the same key → unique violation `23505`. `enqueue` caught the error and returned `deduped`, but in PostgreSQL a failed statement aborts the whole transaction, so `COMMIT` silently became `ROLLBACK`. The API still returned the in-memory row, so the admin saw "success" and then reloaded the old row from the DB.

Any transactional caller of `OutboxService.enqueue` (orders, payments, inventory, blog, CMS pages) had the same latent hazard.

## Fix

| Layer | Change |
|---|---|
| Outbox | `enqueue` = `INSERT … ON CONFLICT DO NOTHING RETURNING id`; duplicate → `deduped`, transaction stays healthy |
| CMS | `upsertSiteContent` uses explicit `repository.update` (+ fresh `updatedAt`), dedupe key includes new timestamp |
| Admin | After PUT, verify GET is adopted only if it does not regress auto→manual; otherwise keep prepared state and warn |
| Admin | `apiClient` fetch `cache: 'no-store'`; `AdminBlockEditor` patches from a ref so rapid edits cannot drop a source change; auto save drops legacy `products` array |

## Ops note

The SSH-bound `auto-deploy.sh` died at Next "Collecting build traces" on the 3.8 GB VPS and left `api`+`web` stopped for ~15 min. Recovered with `docker compose up -d api web`, then rebuilt under `nohup setsid`. Prefer detached builds and never `compose stop` before the image exists.

## Verify

1. Hard-refresh admin, RETAIL tab, set auto (sort/category), save → stays auto, «ذخیره و تأیید شد».
2. `SELECT "updatedAt", blocks->…->>'source' FROM site_contents WHERE channel='RETAIL' AND "pageKey"='home'` → `source=auto`, timestamp moves.
3. New `cms.published` outbox row with a fresh key; `.ir` home shows catalog products within 60 s.

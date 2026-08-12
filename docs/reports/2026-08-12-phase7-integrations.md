# Phase 7 — Sales integrations hardening (Torob / Basalam / Feeds / Affiliate)

**Date:** 2026-08-12  
**Task:** TASK-20260812-001  
**Branch:** `ai/TASK-20260812-001-payment-integrations` (synced with `master` @ `b1c2014`)  
**Scope:** Observability + safe retry notes for existing marketplace/affiliate code  
**Non-goals:** Inventing private Basalam/Torob write APIs; touching TASK-20260810-006 claimed files (blog/RMA/RetailHeader/compare-at/`feeds.controller.ts`)

---

## 1. What changed

| Integration | Health surface | Hardening |
|-------------|---------------|-----------|
| **Feeds** (Torob/Bam catalog) | `GET /v1/feeds/health` (public ops probe) | Fastify `onResponse` hook records `lastSuccess`/`lastError` on `torob.xml` / `bam.csv` / `bam.xml` **without editing** `feeds.controller.ts` |
| **Basalam** | `GET /v1/basalam/health` + enriched `GET /v1/basalam/status` (ADMIN) | In-process tracker; fetch timeouts; in-flight sync mutex; status exposes lastSuccess/lastError |
| **Torob** (order sync) | `GET /v1/torob/health` (ADMIN) | Tracker on `listOrders`; disabled/query failures recorded; panel path unchanged |
| **Affiliate** | `GET /v1/affiliate/health` (ADMIN) | Tracker on fire results; cancelled once-guard (mirrors paid atomic notes tag) |

Shared helper: `apps/api/src/common/integration-health.ts` (`IntegrationHealthTracker`).

---

## 2. Idempotent retry notes

| Path | Safe to retry? | Notes |
|------|----------------|-------|
| `GET /v1/feeds/torob.xml` (and bam CSV/XML) | **Yes** | Read-only catalog export |
| `GET …/torob/v1/orders` | **Yes** | Read-only Torob-Sync contract; empty probe when params omitted |
| `POST /v1/basalam/sync-inventory` | **Yes** | PATCH by Basalam product id upserts price/stock; concurrent runs serialized in-process |
| Affiliate paid/cancelled postback | **Skip after claim** | Atomic `AFFILIATE_POSTBACK_*_AT=` notes tag **before** HTTP GET prevents double conversion. Duplicate callbacks return `already_fired`. Failed-after-claim needs ops reclaim of the tag — not blind re-fire |

---

## 3. Explicit non-invention

- **Basalam:** only existing Core v3 paths (`/users/me`, `PATCH /vendors/{id}/products/bulk`, `PATCH /products/{id}`).
- **Torob:** only existing Torob-Sync orders GET + public feed XML; no private product push API added.
- **Feeds controller body:** left untouched (TASK-006 claim); instrumentation is middleware + separate health controller.

---

## 4. Validation (this wave)

- Commands: `cd apps/api && npx tsc --noEmit`; `npx ts-node --transpile-only src/common/integration-health.spec.ts`
- Results: recorded by implementer in handoff / parent summary after run
- Commit: **not requested** — changes left uncommitted

---

## 5. Residual / owner actions

- Process-local counters reset on API restart (not durable audit).
- Torob panel refresh / full feed crawl remain OWNER / TASK-006 evidence items.
- Basalam production sync still requires configured token + `basalamProductMap`.
- Independent Reviewer/Security still required before production payment/integration ship gates.

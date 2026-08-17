# Project Status

- Last verified: 2026-08-17T10:35:00Z — **SEO/Admin upgrade ready to merge/deploy (not live yet)**
- Active tasks:
  - **TASK-20260817-001** (`in_progress`) — Retail+Wholesale SEO & Admin upgrade — owner `cursor:orchestrator-TASK-20260817-001`
  - **TASK-20260812-001** (`in_progress`) — payment code **LIVE**; BNPL/staging residuals — owner `cursor:orchestrator-TASK-20260812-001`
  - **TASK-20260810-006** (`in_progress`) — readiness remediation — owner `cursor:orchestrator-TASK-20260810-006` (product/SEO file claims reclaimed 2026-08-17 as stale)
- Open residuals before live: merge to master, VPS deploy, TypeORM migration `SeoAdminUpgrade1755410400001`, health check
- Code SHA (origin/master): **`5880f95`** until this wave merges
- VPS `/opt/taranom` HEAD: **`b7bd11a`** (matches master)
- Live health:
  - API → **200** ok
  - Wholesale / retail → **200**
  - Eligible → ZARINPAL + MANUAL only
- Prod payment schema: payment_events + providers + installment_* present
- Readiness: **71/100** unchanged
- Website-builder: **blocked**
- Open residuals (not deploy gaps): BNPL contracts; staging E2E

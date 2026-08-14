# Project Status

- Last verified: 2026-08-14T09:20:00Z — **full live apply confirmed**
- Active tasks:
  - **TASK-20260812-001** (`in_progress`) — payment code **LIVE** at `b7bd11a`; BNPL/staging residuals only — owner `cursor:orchestrator-TASK-20260812-001`
  - **TASK-20260810-006** (`in_progress`) — readiness remediation — owner `cursor:orchestrator-TASK-20260810-006`
- Code SHA (origin/master): **`b7bd11a`**
- VPS `/opt/taranom` HEAD: **`b7bd11a`** (matches master)
- Live health:
  - API → **200** ok
  - Wholesale / retail → **200**
  - Eligible → ZARINPAL + MANUAL only
- Prod payment schema: payment_events + providers + installment_* present
- Readiness: **71/100** unchanged
- Website-builder: **blocked**
- Open residuals (not deploy gaps): BNPL contracts; staging E2E

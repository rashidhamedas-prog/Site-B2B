# Project Status

- Last verified: 2026-08-12T16:55:00Z (Payment Phase 0 preflight; live health re-check)
- Active tasks:
  - **TASK-20260812-001** (`in_progress`) — Payment and Sales Integrations Phase 0 — owner `cursor:orchestrator-TASK-20260812-001`
  - **TASK-20260810-006** (`in_progress`) — readiness remediation — owner `cursor:orchestrator-TASK-20260810-006` (apps/* claims retained; governance/report glob handed off for payment Phase 0)
- Payment branch / worktree: `ai/TASK-20260812-001-payment-integrations` @ `D:/soft/Claud/porje/Site B2B`
- Code SHA (origin/master at preflight): `27456b3` / `27456b3c5ca2f665be1fa062a047f644a607802c`
- Prior readiness ship SHA (historical): `ee9c044` (PR #31) — superseded on master by later SEO commits including `27456b3`
- Live health (Phase 0 read-only, 2026-08-12):
  - API `https://api.poshaktaranom.com/v1/health` → **200** `{"status":"ok","service":"taranom-api","version":"1.0"}`
  - Wholesale `https://poshaktaranom.com/` → **200** (www → apex redirect then 200)
  - Retail `https://www.poshaktaranom.ir/` → **200**
- Readiness: **GO WITH CONDITIONS** **71/100** (unchanged; payment preflight does not raise score)
- Conditions: **C4 Satisfied**; **C1/C3 accepted-with-expiry → 2026-09-09**
- Website-builder: **blocked**
- Payment program: Phase 0 preflight **complete** (docs only). Phase 1 **not started**. BNPL adapters **BLOCKED** pending official contracts. No production deploy from Phase 0.
- Evidence: `docs/reports/2026-08-12-payment-integrations-preflight.md` + `docs/reports/_preflight-20260812/`

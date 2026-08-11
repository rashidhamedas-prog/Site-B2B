# Project Status

- Last verified: 2026-08-11T13:29:07Z (PR #31 live verify)
- Active task: **TASK-20260810-006** (`in_progress`) — owner `cursor:orchestrator-TASK-20260810-006`
- Branch / worktree: `ai/TASK-20260810-006-readiness-remediation` @ `D:/soft/Claud/porje/Site-B2B-wt-TASK-20260809-002`
- Code SHA (origin/master): `ee9c044` / `ee9c044e9e72f76e11e53e53534a360f6efc6d1a` (PR #31 merge; remediation `46821e8`)
- Evidence SHA (scored 71 wave): PR #28 era — keep distinct
- Deploy / VPS SHA: `/opt/taranom` HEAD = `ee9c044` (auto-deploy exit **0** ~2026-08-11T13:29Z)
- Live health (post-deploy):
  - API `https://api.poshaktaranom.com/v1/health` → **200** `{"status":"ok","service":"taranom-api","version":"1.0"}`
  - Wholesale `https://www.poshaktaranom.com/` → **200**
  - Retail `https://www.poshaktaranom.ir/` → **200**
  - Containers: api/web Up ~2 min; nginx ~1 min; postgres/redis/meili/minio healthy
- Readiness: **GO WITH CONDITIONS** **71/100** (unchanged; deploy/health alone do **not** raise score)
- Conditions: **C4 Satisfied**; **C1/C3 accepted-with-expiry → 2026-09-09**
- Website-builder: **blocked**
- Claims: **retained**; task remains **in_progress** — staging E2E / retail OTP / rollback-offbox / full Torob still **NOT RUN** → not Done
- Residual open: staging sanitized E2E; retail OTP→ONLINE; rollback/off-box/MinIO; full Torob; fresh reviews on post-ship evidence

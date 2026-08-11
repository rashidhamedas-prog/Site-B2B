# PR #31 ship evidence — 2026-08-11

Durable record of post-merge deploy/health only. Does **not** change readiness score or task Done status.

## Ship

| Item | Value |
| --- | --- |
| PR | https://github.com/rashidhamedas-prog/Site-BtoB/pull/31 (merged) |
| Merge commit (master) | `ee9c044` / `ee9c044e9e72f76e11e53e53534a360f6efc6d1a` |
| Remediation commit | `46821e8` |
| VPS path | `/opt/taranom` |
| VPS HEAD | `ee9c044` |
| Auto-deploy | exit **0** ~2026-08-11T13:29Z |

## Live verify

| Target | Result |
| --- | --- |
| `https://api.poshaktaranom.com/v1/health` | **200** `{"status":"ok","service":"taranom-api","version":"1.0"}` |
| `https://www.poshaktaranom.com/` (wholesale) | **200** |
| `https://www.poshaktaranom.ir/` (retail) | **200** |
| Containers | api/web Up ~2 min; nginx ~1 min; postgres/redis/meili/minio healthy |

## Governance (unchanged)

- Task **TASK-20260810-006**: `in_progress` (not Done)
- Readiness: **71/100** (do not raise from deploy/health alone)
- `file_claims`: retained / not released
- Website-builder: blocked
- Still **NOT RUN**: staging sanitized E2E; retail OTP→ONLINE; rollback/off-box/MinIO; full Torob

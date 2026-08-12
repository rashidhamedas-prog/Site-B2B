# Payment residuals closure wave — 2026-08-13

**Task:** TASK-20260812-001  
**Branch:** `ai/TASK-20260812-001-payment-integrations`

## Delivered this wave
| Item | Status |
|------|--------|
| `payment_events` table + entity + record on verify | **SHIPPED** (migration `20260812-005`) |
| 20-parallel CAS concurrency + idempotency + refund-cap suite | **SHIPPED** (`payment-concurrency.hardening.spec.ts`) |
| Phase 8 runbooks (incident/outage/refund/settlement) | **SHIPPED** under `docs/runbooks/` |
| CI: API payment unit suite + npm audit | **SHIPPED** in `.github/workflows/ci.yml` |

## Explicitly still BLOCKED / accepted
| Item | Status |
|------|--------|
| Live BNPL adapters (SnappPay/…) | **BLOCKED** — needs official contracts/docs/credentials |
| Staging sanitized E2E without real money | **NOT RUN** — no separate staging stack evidence this wave; C1 accepted-with-expiry elsewhere |
| Disposable Postgres up/down/up of all payment migrations | **NOT RUN** this wave (migrations additive; production migrate-on-boot) |
| Full container/SAST/CodeQL | **PARTIAL** — `npm audit` in CI; deeper SAST residual |

## Live baseline before deploy
Recorded after ship: API/wholesale/retail health + eligible ZARINPAL+MANUAL only.

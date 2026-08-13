# Payment residual wave — disposable migrations + CodeQL (2026-08-14)

**Task:** TASK-20260812-001

## Disposable migration up/down/up
- Script: `scripts/payment-migrations-disposable-updown.sh`
- Host: VPS `taranom_postgres` (NOT `taranom_db`)
- DB: `taranom_payment_mig_test` created → up → down → up → down → dropped
- Result: **`PAYMENT_MIGRATIONS_DISPOSABLE_UPDOWN_UP_OK`**
- Covers payment migrations 20260812-001 … 005 (SQL mirrors on stubs)

## CodeQL
- Added `.github/workflows/codeql.yml` (security-extended, JS/TS)

## Still BLOCKED / NOT RUN
| Item | Status |
|------|--------|
| BNPL live adapters | **BLOCKED** (contracts) |
| Staging sanitized purchase E2E | **NOT RUN** (no staging stack this wave) |
| Retail OTP→ONLINE sandbox E2E | **NOT RUN** (TASK-006 / staging) |

## Live
Record after ship: health + eligible ZARINPAL+MANUAL.

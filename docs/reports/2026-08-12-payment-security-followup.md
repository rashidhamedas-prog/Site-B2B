# Payment security follow-up (post PR #34/#35)

**Date:** 2026-08-12  
**Task:** TASK-20260812-001

## Findings addressed

| Severity | Issue | Fix |
|----------|--------|-----|
| HIGH | Unauthenticated NOK verify could CANCEL and block later OK PSP verify | Soft-cancel CAS from PENDING/FAILED only; CANCELLED+OK recovers via PSP verify + CAS includes CANCELLED→PAID |
| HIGH | Invoice overpay on verify | Remainder guard before `paidAmount` bump |
| HIGH | Refunds exceed payment total | Cumulative SUM(SUCCEEDED) cap |
| HIGH | Affiliate postback lost after claim | Pending notes claim + release on HTTP failure; payment `postbackFiredAt` cleared on failure |
| HIGH | Wallet-only ONLINE fired paid affiliate at create | ONLINE with remainder waits for verify; wallet-settled (0) confirms then fires paid; CASH→pending only |
| MEDIUM | Concurrent payment starts | Advisory lock + reuse PENDING per order |
| MEDIUM | Eligible providers leaked `configReference` | Public DTO strip |

## Specs
- `payment-hardening.followup.spec.ts` (math/CAS status invariants)
- Existing `payment-core.hardening.spec.ts`

## Residual / blocked
- Full DB concurrency suite (20 parallel callbacks) still needs disposable DB evidence
- BNPL live adapters BLOCKED
- Staging sanitized E2E without real money still OWNER/ops
- Independent Reviewer+Security PASS on **this** commit SHA still required before marking program Done

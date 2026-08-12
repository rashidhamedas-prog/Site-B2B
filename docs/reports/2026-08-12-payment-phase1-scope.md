# Payment Phase 1 — Scope Freeze (P0 payment core)

**Date:** 2026-08-12  
**Task:** `TASK-20260812-001`  
**Prerequisite:** Phase 0 preflight **COMPLETE** — `docs/reports/2026-08-12-payment-integrations-preflight.md`  
**Status:** Scope + file_claims frozen; **implementation NOT started** in this document wave.

---

## 1. Phase 0 closure checklist

| AC | Result |
|----|--------|
| Preflight report with git/HEAD/claims/gates/live health | **MET** (`06bf085` / `80c3f41`) |
| No runtime code / no production deploy in Phase 0 | **MET** |
| Formal handoff from TASK-006 for `docs/reports/` | **MET** |
| BNPL blocked; no guessed endpoints | **MET** |
| Expand Phase 1 file_claims before apps/* edit | **MET** (this document + `active.yaml`) |

Phase 0 is **closed**. Remaining program work continues as Phase 1+ under the same task id.

---

## 2. Phase 1 goal

Make existing ZarinPal + order/invoice payment paths **production-grade** without introducing live BNPL adapters:

1. Race-safe verify (DB transaction + row lock / CAS PENDING→PAID)
2. Correct idempotency (customerId + channel + operation; ownership; payload hash → 409 on mismatch)
3. Recovery after failed start (payment attempts; retry; clear order/payment states)
4. Provider HTTP timeout / safe retry / normalized errors
5. Allowlisted payment output DTO (no raw entity/meta to client)
6. Manual invoice payment: finite positive; no overpay; ledger; audit; transactional
7. RefundEntity + lifecycle (wallet vs provider paths separated; idempotent)
8. JWT/session hardening: **out of Phase 1 code** — tracked as coordinated follow-up / separate claim wave (see non-goals)

---

## 3. Non-goals (Phase 1)

- SnappPay / DigiPay / Tara / AzkiVam / any BNPL live API (Phase 4–5; **BLOCKED**)
- Provider registry admin UI (Phase 3)
- Full installment contracts (Phase 6)
- Torob/Basalam/affiliate redesign (Phase 7)
- Touching TASK-20260810-006 claimed files (blog, RMA, RetailHeader, compare-at product paths, etc.)
- Production deploy before staging evidence + backup/rollback + Reviewer/Security PASS
- Guessing provider webhooks/signatures

---

## 4. Acceptance criteria (Phase 1)

### Functional / correctness

- [ ] Concurrent verify (20 parallel callbacks) → exactly one PAID transition
- [ ] `paidAmount` increments once
- [ ] Affiliate postback fires once for a payment
- [ ] Idempotency cross-customer → 403/404
- [ ] Same key / different payload → 409
- [ ] Provider timeout and unavailable → normalized internal error; no hang
- [ ] Retry payment after failed start succeeds without dead order
- [ ] Duplicate refund rejected / idempotent
- [ ] Manual overpayment / negative / NaN rejected

### Engineering

- [ ] Additive TypeORM migration(s); disposable DB up/down/up
- [ ] Quality gates: format-check (scoped), lint, typecheck web+api, test, build, `git diff --check`
- [ ] Independent Reviewer **PASS**
- [ ] Independent Security **PASS**
- [ ] Staging migrate + smoke/E2E without real money
- [ ] Production only after backup/rollback confirmation

---

## 5. File claims (exact — expand before first edit)

### Existing (modify)

| Path | Why |
|------|-----|
| `apps/api/src/modules/payment/payment.service.ts` | verify/start/manual race-safety, DTO, provider client |
| `apps/api/src/modules/payment/payment.controller.ts` | DTO responses; verify auth surface |
| `apps/api/src/modules/payment/payment.module.ts` | wire new entities/services |
| `apps/api/src/modules/payment/entities/payment.entity.ts` | attempts linkage / status clarity |
| `apps/api/src/modules/order/order.service.ts` | scoped idempotency; start recovery; INSTALLMENT note untouched beyond payment-state clarity |
| `apps/api/src/modules/order/entities/order.entity.ts` | idempotency payload hash / status fields if additive |
| `apps/api/src/modules/order/dto/create-order.dto.ts` | payment DTOs shared today |
| `apps/api/src/modules/invoice/invoice.service.ts` | manual payment overpay guards + txn |
| `apps/api/src/modules/invoice/entities/invoice.entity.ts` | only if additive columns required |
| `apps/api/src/modules/affiliate/affiliate-postback.service.ts` | once-only postback coordination |
| `apps/api/src/config/database.config.ts` | register new entities |
| `apps/web/src/app/payment/callback/page.tsx` | consume allowlisted verify DTO |

### New (create under claim)

| Path | Why |
|------|-----|
| `apps/api/src/modules/payment/dto/payment-public.dto.ts` | allowlisted client DTO |
| `apps/api/src/modules/payment/entities/payment-attempt.entity.ts` | attempts / retry |
| `apps/api/src/modules/payment/entities/refund.entity.ts` | refund lifecycle |
| `apps/api/src/modules/payment/entities/payment-ledger-entry.entity.ts` | immutable ledger |
| `apps/api/src/modules/payment/payment-orchestrator.service.ts` | provider-agnostic orchestration (ZarinPal adapter only active) |
| `apps/api/src/modules/payment/adapters/payment-provider.adapter.ts` | adapter contract |
| `apps/api/src/modules/payment/adapters/zarinpal.adapter.ts` | extract ZarinPal from service |
| `apps/api/src/modules/payment/adapters/disabled.adapter.ts` | fail-closed stub for non-approved providers |
| `apps/api/src/database/migrations/20260812-001-payment-core-hardening.ts` | additive schema |
| `apps/api/src/modules/payment/*.spec.ts` (concurrency/idempotency/refund/manual) | required tests |
| `docs/reports/2026-08-12-payment-phase1-*.md` | evidence reports |
| `docs/adr/008-payment-orchestrator.md` (if created) | architecture decision |

### Explicitly NOT claimed (avoid TASK-006 / separate auth)

- Any `apps/api/src/modules/rma/**`
- Any blog / RetailHeader / product compare-at files claimed by TASK-006
- Auth cookie/CSP/JWT hardening files (separate coordinated task)
- BNPL provider SDK files

---

## 6. Rollback

- Code: revert Phase 1 commits / feature-flag kill switch for new verify path if dual-path used
- DB: migration `down()` must be additive-safe (drop only Phase-1-owned tables/columns; no payment history destroy without ownership ledger pattern)
- Deploy: staging first; production rollback = previous image + migrate down only if rehearsed

---

## 7. Risk

**High** — payments, PII-adjacent logs, money movement. Requires independent Reviewer + Security before Done. No production money in automated tests.

---

## 8. Exact next action (implementation)

1. Heartbeat + confirm claims in `active.yaml` (done with this freeze).
2. Implement race-safe `verify` + concurrency test first.
3. Then idempotency + recovery + DTO + manual + refund skeleton.
4. Run disposable migration up/down/up + full gates.
5. Request independent Security then Reviewer.
6. Staging only after PASS; production only with backup/rollback evidence.

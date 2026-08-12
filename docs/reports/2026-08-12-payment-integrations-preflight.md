# Payment & Sales Integrations — Phase 0 Preflight

**Date (local):** 2026-08-12  
**UTC window:** ~2026-08-12T15:50Z–16:55Z  
**Role:** Orchestrator + Architect  
**Task:** `TASK-20260812-001` (Phase 0 only)  
**Program:** Payment & Sales Integrations (PSP + BNPL + B2B installments + marketplace/affiliate)  
**Authoritative checkout:** `D:\soft\Claud\porje\Site B2B`  
**Do not use:** `D:\soft\claud\porje\Site BtoB` (incomplete snapshot)

---

## 1. Verdict

**READY TO PLAN Phase 1 (P0 payment-core remediation)** — with explicit gates:

| Gate | Status |
|------|--------|
| Production mutate / deploy this phase | **FORBIDDEN** (honored) |
| Guess BNPL endpoints/signatures | **FORBIDDEN** (honored) |
| SnappPay / DigiPay / Tara / AzkiVam live adapters | **BLOCKED** until official contract docs + credentials |
| Parallel claim conflict with TASK-20260810-006 | **RESOLVED** via formal handoff (see §3) |
| Runtime code changes this phase | **NONE** |
| Baseline quality gates | **PASS with noted exceptions** (§6) |

Phase 1 must not start until: scope/AC/rollback/file_claims for payment-core are recorded, Reviewer+Security identities are reserved as independent, and disposable DB is available for migration up/down/up.

---

## 2. Repository baseline

| Item | Value |
|------|-------|
| Branch (this session) | `ai/TASK-20260812-001-payment-integrations` (created from `master`) |
| HEAD | `27456b3` (`27456b3c5ca2f665be1fa062a047f644a607802c`) |
| `origin/master` tip at start | same `27456b3` — `perf(seo): P3 backlog…` |
| Node | `v22.23.1` (≥20 required) |
| npm | `10.9.8` (packageManager pin `npm@10.9.2`) |
| Lockfile | `package-lock.json` present |
| Docker | `docker-compose.yml` present |
| CI | `.github/workflows/ci.yml` present |
| Primary branch | `master` |

### 2.1 Preserved dirty worktree (user-owned — NOT staged)

Unrelated local work remains untouched. Snapshot at preflight start included (non-exhaustive):

- Modified SEO/storefront paths under `apps/web/**`, `SEO-REDIRECT-MAP.csv`, `scripts/seo/audit.mjs`
- Untracked: `.ai-dos/backups/`, `.local-backup-20260811/`, `.seo-baseline/`, stub `docs/00`–`11`, `prompts/`, `tasks/`, `body.tmp`, `bot-body.tmp`, etc.
- Parallel worktree for TASK-006: `D:/soft/Claud/porje/Site-B2B-wt-TASK-20260809-002` on `ai/TASK-20260810-006-readiness-remediation` @ `7d69350` — **not used for payment Phase 0**

**Rule:** no `git add .`; only claimed payment Phase 0 docs may be committed.

---

## 3. Active task / file-claim conflict resolution

### 3.1 Prior state

- **TASK-20260810-006** `in_progress`, owner `cursor:orchestrator-TASK-20260810-006`
- Heartbeat `2026-08-11T13:29:07Z` (~26h before this session; > `stale_claim_hours: 24`)
- Claimed among others: `docs/reports/` (directory), `docs/WORKLOG.md`, `.ai-dos/tasks/*`, `.ai-dos/project/status.md`, plus large `apps/*` remediation set
- Readiness **71/100**; website-builder **blocked**; staging E2E / retail OTP / rollback-offbox / full Torob still **NOT RUN**

### 3.2 Formal handoff (Orchestrator)

1. **TASK-20260810-006 remains `in_progress`** for readiness AC — claims on `apps/*`, scripts, and non-payment docs **retained**.
2. **Released from TASK-006:** directory claim `docs/reports/` (future reports claimed per-file).
3. **New task TASK-20260812-001** owns Payment program Phase 0 deliverables and temporary governance writes for this program’s registry/status/WORKLOG entries.
4. No overlapping `apps/api` payment file claims yet — Phase 1 must expand claims **before** any payment code edit.
5. Payment Phase 0 worktree = this Site B2B checkout; dedicated worktree optional from Phase 1 when editing `apps/*`.

---

## 4. Scope freeze (Architect)

### 4.1 Program goal (multi-phase)

Provider-agnostic Payment Orchestrator + adapters for:

- PSP (ZarinPal now; others later)
- BNPL (SnappPay, DigiPay, Tara, AzkiVam — **contract-gated**)
- Internal B2B installments (real contracts, not notes)
- Refund / settlement / reconciliation / accounting
- Both WHOLESALE + RETAIL
- Sales feeds: Torob, Basalam, affiliate (Yektanet/etc.) — later phases

### 4.2 Phase 0 (this deliverable) — in scope

- Read-only discovery, baseline gates, live health probes
- Gap analysis vs P0 payment-core requirements
- Program task claim + report
- Docs-only commit/push of claimed files
- **No** deploy, **no** migration apply, **no** production money, **no** runtime change

### 4.3 Non-goals (Phase 0)

- Any `apps/*` edit
- BNPL adapter implementation or fake endpoints
- JWT/session cookie rewrite (separate coordinated task)
- Production or staging deploy
- Raising readiness score
- Closing TASK-006 AC

### 4.4 Acceptance criteria (Phase 0)

- [x] git/status/HEAD/active-task/claims recorded
- [x] User dirty tree listed and preserved
- [x] Node/npm/lockfile/Docker/CI/migrations/env payment keys inspected
- [x] Baseline gates executed with exit codes
- [x] Live API + wholesale + retail probed read-only
- [x] Report written under `docs/reports/`
- [x] No runtime deploy

### 4.5 Rollback (Phase 0)

Docs-only: revert the Phase 0 commit. No DB/runtime rollback needed.

---

## 5. Current payment architecture (as-built evidence)

### 5.1 Components

| Piece | Path / evidence |
|-------|-----------------|
| Payment Nest module | `apps/api/src/modules/payment/` |
| Entity | `payments` — amount BIGINT IRR; gateway default `ZARINPAL`; status PENDING/PAID/FAILED/CANCELLED/REFUNDED; `authority`/`refId` unique |
| Hardening migration | `20260731-001-hardening-payment-order-unique.ts` (authority/refId + order `idempotencyKey`) |
| Checkout txn hardening | Order create in DB transaction (`docs/reports/2026-07-31-checkout-transaction-hardening.md`) |
| Gateway | ZarinPal v4 REST **hard-wired** in `payment.service.ts` |
| Env schema (example) | `ZARINPAL_*`, `PAYMENT_CALLBACK_URL`, `PAYMENT_RETAIL_CALLBACK_URL` in `.env.example` |
| Channels | Wholesale + retail merchant/sandbox/callback via settings |
| INSTALLMENT | Order notes tag only (`INSTALLMENT downPayment=…`) — **not** a contract/schedule |
| RMA refunds | Wallet/BANK on return requests — **not** PSP RefundEntity lifecycle |
| Feeds/affiliate | `feeds`, `basalam`, `torob`, `affiliate` modules exist; not payment-orchestrator-backed |

### 5.2 Critical P0 gaps (for Phase 1)

| # | Requirement | Current evidence | Risk |
|---|-------------|------------------|------|
| 1 | Race-safe verify in one DB txn + row lock/CAS | `verify()` re-reads then saves without pessimistic lock/txn; invoice `paidAmount` += outside atomic CAS; affiliate postback fire-and-forget after save | **HIGH** — duplicate callback can double-apply paidAmount / side effects |
| 2 | Idempotency scoped by customer+channel+op + payload hash | Order key is globally unique `idempotencyKey`; reuse returns existing order **without** ownership/payload check | **HIGH** — cross-customer collision / payload swap |
| 3 | Recovery after failed start; payment attempts; reservation expiry | Failed start marks payment FAILED; order may remain without usable URL; no `payment_attempts` table | **HIGH** |
| 4 | Provider timeout/retry/circuit + normalize errors | `fetch` without AbortController/timeout/retry policy | **MEDIUM** |
| 5 | Allowlisted payment DTO to client | `verify` returns raw `PaymentEntity` incl. `meta` | **MEDIUM** |
| 6 | Manual invoice payment: finite positive, no overpay, ledger, audit | `recordManual` / `invoice.recordPayment` weak validation; no ledger | **HIGH** |
| 7 | RefundEntity + provider vs wallet separation | Status enum only; RMA wallet path separate | **HIGH** |
| 8 | Provider registry (enabled ≠ enum) | Gateway string on entity; no capabilities/health/contractStatus | **HIGH** for BNPL roadmap |
| 9 | JWT HttpOnly/CSP/role-cookie | Separate task; middleware cookie gate is UX-only | Track under auth hardening |

**Architectural principle confirmed:** Checkout/Order must not call provider APIs directly long-term; introduce `PaymentProviderAdapter` + orchestrator. Today Order → `PaymentService.start()` → ZarinPal is a direct coupling to remediate in Phases 1–2.

---

## 6. Quality gate results (this checkout)

Artifacts: `docs/reports/_preflight-20260812/`

| Gate | Command | Exit | Notes |
|------|---------|-----:|-------|
| npm ci (disposable) | — | **NOT RUN** | Dirty worktree + user preserve rule; would wipe/replace `node_modules`. Existing install reused. |
| format (mutating) | `npm run format` | **SKIPPED** | Would rewrite hundreds of unrelated files. |
| format-check | `npx prettier --check "**/*.{ts,tsx,js,jsx,json,css,md}"` | **1** | 561 files (mostly docs/SEO/package noise). Not a payment-code blocker. |
| lint | `npm run lint` (turbo → api/web `tsc --noEmit`) | **0** | ~46s |
| typecheck web | `npm run type-check -w @taranom/web` | **0** | |
| typecheck api (bad wrapper) | `cmd /c cd apps\api && npx tsc --noEmit` | **1** | Wrapper invoked `tsc` help (arg quoting). **Invalid run.** |
| typecheck api (valid) | `Push-Location apps/api; npx --no-install tsc --noEmit` | **0** | ~198s; authoritative |
| test | `npm run test` | **0** | turbo; existing OTP/blog specs |
| build | `npm run build` | **0** | turbo api+web ~15m27s; wrapper hung after success — exit taken from log |
| `git diff --check` | full dirty tree | **0** | |

**System proxy used for Node CLIs:** `HTTP(S)_PROXY=http://127.0.0.1:10808` (session-only).

---

## 7. Live probes (read-only — no mutate)

| Target | Result |
|--------|--------|
| `GET https://api.poshaktaranom.com/v1/health` | **200** `{"status":"ok","service":"taranom-api","version":"1.0"}` |
| `https://www.poshaktaranom.com/` → follow | **200** (1 redirect to `https://poshaktaranom.com/`) |
| `https://poshaktaranom.com/` | **200** |
| `https://www.poshaktaranom.ir/` | **200** |

No checkout mutation, no payment start/verify, no admin login, no deploy.

---

## 8. Env / migrations / CI notes

- Payment secrets: env/settings only; `.env.example` uses `CHANGE_ME` placeholders — **do not commit secrets**.
- TypeORM migrations present through `20260810-005-…`; payment uniqueness already partially landed (`20260731-001-hardening-payment-order-unique`).
- Phase 2 provider tables must be **additive**, no `synchronize` in production.
- CI: lint/typecheck/build oriented; payment concurrency suite **not present** yet (Phase 1 deliverable).

---

## 9. Phase roadmap (binding for later tasks)

| Phase | Focus | Entry condition |
|------:|-------|-----------------|
| 0 | Preflight (this report) | Done when committed |
| 1 | P0 payment core (race-safe verify, idempotency, recovery, DTO, manual, refund skeleton, provider client hygiene) | Expand file_claims; disposable DB; independent Reviewer+Security |
| 2 | Provider-agnostic data model | Phase 1 PASS + reviews |
| 3 | Provider registry + admin | Phase 2 PASS |
| 4 | SnappPay | **BLOCKED** on official docs + credentials; skeleton/disabled only before then |
| 5 | Other BNPL (per-vendor assessment + score) | Contract APPROVED |
| 6 | Internal B2B installment contracts | After core payment + credit model |
| 7 | Torob / Basalam / affiliate hardening | Per-integration tasks |
| 8 | Observability + CI security scans | Continuous, harden late |

Each phase exit: validate → independent Reviewer+Security → commit claimed only → push → **staging** migrate/smoke → backup/rollback confirm → production only if PASS — **never skip staging**.

---

## 10. Exact next action

1. Human/orchestrator: merge/push Phase 0 docs commit on `ai/TASK-20260812-001-payment-integrations` (no deploy).
2. Open Phase 1 task claims for exact payment files (`payment.service.ts`, order idempotency paths, new entities/migrations/tests) — **do not** overlap TASK-006 claimed files.
3. Implement race-safe verify + scoped idempotency first; attach concurrency tests (20 parallel callbacks).
4. Keep all BNPL providers `DISABLED` / `NOT_STARTED` until contracts arrive.

---

## 11. Evidence index

- Gate logs: `docs/reports/_preflight-20260812/*.log` + `*.exit.txt`
- Handoff: `.ai-dos/tasks/handoff.md` (entry 2026-08-12 payment Phase 0)
- Status: `.ai-dos/project/status.md`
- Active registry: `.ai-dos/tasks/active.yaml`

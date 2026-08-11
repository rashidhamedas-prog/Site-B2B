# TASK-20260810-006 — Diff package for Independent Reviews

**Do not commit/deploy from this package.** Task stays `in_progress`; claims retained; readiness **71/100**.

| Field | Value |
|---|---|
| Generated | 2026-08-10T19:48:59+03:30 |
| Worktree | `D:/soft/Claud/porje/Site-B2B-wt-TASK-20260809-002` |
| Branch | `ai/TASK-20260810-006-readiness-remediation` |
| HEAD (branch tip) | `015b5ec` |
| Live baseline `origin/master` | `ab4ffab` (PR #30) |
| Prior review base | `55e58ad` |
| Scope | **Uncommitted** remediation vs HEAD (not shipped) |

## Artifacts (durable)

Directory: `docs/reports/TASK-20260810-006-review-20260810-194859/`

| File | Purpose |
|---|---|
| `MANIFEST.txt` | Identity / SHA |
| `remediation-tracked.diff` | **Preferred** scoped tracked diff for review |
| `remediation-tracked-files.txt` | Scoped file list |
| `untracked.diff` | New remediation files |
| `changed-untracked.txt` | New file paths |
| `tracked.diff` | Broader dirty tree (includes unrelated local noise — **ignore for review**) |

## In-scope tracked files

- `.ai-dos/project/status.md`, `.ai-dos/tasks/active.yaml`, `.ai-dos/tasks/handoff.md`
- `.env.example`
- `apps/api/src/main.ts`
- `apps/api/src/database/migrations/20260810-001-create-return-requests.ts`
- `apps/api/src/database/migrations/20260810-002-product-compare-at-prices.ts`
- `apps/api/src/modules/blog/blog-extras.service.ts`, `blog.controller.ts`, `entities/blog-media-asset.entity.ts`
- `apps/api/src/modules/product/dto/create-product.dto.ts`, `product.service.ts`
- `apps/api/src/modules/redis/redis.module.ts`
- `apps/api/src/modules/rma/rma.service.ts`, `rma.controller.ts`, `rma.module.ts`
- `apps/web/src/components/admin/AdminProducts.tsx`
- `apps/web/src/components/blog/BlogAnalyticsTracker.tsx`
- `docs/02-target-architecture.md`, `PLATFORM-READINESS-REPORT.md`, `WORKLOG.md`, `deployment-runbook.md`, `implementation-progress.md`
- `scripts/e2e-purchase-test.sh`, `scripts/_negative-e2e-guards.sh`

## In-scope untracked (new)

- `apps/api/src/common/client-ip.ts`
- `apps/api/src/database/migrations/20260810-001-create-return-requests.spec.ts`
- `apps/api/src/database/migrations/20260810-003-return-request-audit.ts`
- `apps/api/src/database/migrations/20260810-004-blog-media-tombstone.ts`
- `apps/api/src/database/migrations/20260810-005-customer-channel-classification.ts`
- `apps/api/src/modules/blog/blog-analytics-rate-limit.spec.ts`
- `apps/api/src/modules/product/product-pricing.invariant.spec.ts`
- `apps/api/src/modules/rma/entities/return-request-audit.entity.ts`
- `scripts/provision-e2e-identity.sh`

## Out of scope / ignore

- `.ai-dos/backups/**`, `.ai-dos/prompts/**`, `install-manifest.json`
- Unrelated dirty `.claude/**`, `.cursor/skills/**`, `.ai-dos/QUALITY-GATES.md`, `.ai-dos/SECURITY-REVIEW.md` if present in broad `tracked.diff`

## Prior HIGH findings under review

1. RMA migration destructive `down()` on adopted tables
2. E2E forgeable host allowlists / no environment identity
3. SQL disposable guards name-only
4. Blog analytics XFF trust + unbounded Map + client `x-blog-uv`
5. `retailPrice` optional while `showOnRetail=true`

## Requested verdicts

1. **Independent Security Review** — PASS / PASS WITH CONDITIONS / FAIL; list remaining High/Med/Low
2. **Independent Reviewer** — PASS / PASS WITH CONDITIONS / FAIL; AC / regression / test adequacy

Agents launched: Security Review + Bugbot + Independent Reviewer (read-only).

# MASTER — Existing Retail & Wholesale Completion Program

## Authority and scope

This is the authoritative execution contract for completing the existing retail and wholesale websites before a separate website-builder project starts. If repository instructions conflict, obey the safer or more restrictive rule and record the conflict. Human instructions and applicable law always prevail.

In scope: inspect, audit, stabilize, repair, refactor, test, document, deploy safely, and make reusable the existing commerce system. Out of scope: building a SaaS platform, tenant provisioning, tenant isolation, subscriptions for a future builder, drag-and-drop/page/schema builders, template marketplaces, or migrating customers to a new platform.

## Mandatory reading order

First discover and read every applicable `AGENTS.md` from repository root toward each intended file. Then read this file, `00_SYSTEM_RULES.md`, files `01` through `13` in numeric order, and finally `99_PLATFORM_READINESS_REPORT_TEMPLATE.md`. If `AGENTS.md` defines a different AI-DOS reading order, follow it and record the resolved order. Repository-local instructions override this generic package unless they violate an explicit human instruction or safety boundary. Do not modify code before completing the AI-DOS preflight, conflict check, task claim, risk classification, baseline verification, and recovery plan.

## Role and AI-DOS governance

Act as **Orchestrator and Architect** unless an active task assigns another role. Before editing:

1. Inspect `.ai-dos/` and read its governance, architecture, decisions, plans, status, task registry, and handoff documents in the order required by `AGENTS.md`.
2. Verify documentation against code, configuration, migrations, tests, CI, and deployment files. Mark mismatches as stale; code is not automatically correct merely because it is current.
3. Read `.ai-dos/tasks/active.yaml` using its existing schema. Identify overlapping task scope, affected files, branches/worktrees, and owners.
4. Define this task's ID/title, scope, non-goals, acceptance criteria, affected/claimed files, risk, rollback, validation, branch/worktree, owner, dependencies, and status.
5. Claim the task atomically before editing. Never overwrite, weaken, or bypass another active claim. If scope overlaps, stop and coordinate or split scope.
6. Update `.ai-dos/tasks/handoff.md` at start, meaningful checkpoints, blocker/ownership transfer, and completion, following the repository's format.

If a required AI-DOS file is missing, do not pretend the preflight passed. Report the missing artifact and use the repository's documented bootstrap process. If no process exists, propose the smallest compatible files/fields and request approval before establishing governance.

## Required preflight report — before any code modification

Report all of the following with repository evidence:

- Architecture and runtime/data/deployment topology.
- Current state; completed work; remnant/partial work; dirty changes.
- Active tasks, owners, branches/worktrees, file claims, and conflicts.
- Risks, unknowns, missing/stale documentation, and documentation/code discrepancies.
- Available build, lint, format, type, unit, integration, E2E, security, migration, and deployment commands; distinguish verified from inferred.
- Proposed task contract: scope, non-goals, acceptance criteria, affected/claimed files, risk level, rollback, validation, branch/worktree, ownership, dependencies, and approval gates.
- Preflight decision: `READY TO CLAIM`, `BLOCKED BY CONFLICT`, or `BLOCKED BY MISSING AUTHORITY`.

No source/configuration/schema edit is allowed until the report is complete and the task is successfully claimed. Documentation-only updates needed to record the preflight/claim are permitted.

## Execution protocol

1. **Discover:** identify repositories/apps, stack, commands, environments, ownership boundaries, public URLs, integrations, data stores, queues, scheduled jobs, and retail/wholesale entry points. Reconcile documentation with evidence. Label unknowns; never invent answers.
2. **Protect:** create an isolated working branch/worktree, capture clean/dirty state, preserve user changes, identify backup/restore mechanisms, and define rollback for the first change. Never copy production secrets or customer data.
3. **Baseline:** install only approved dependencies; run existing build, lint, type, unit, integration, and E2E checks. Record commands, versions, failures, and reproducibility.
4. **Audit:** produce `docs/01-current-system-audit.md` using file `01`. Map critical flows and risks with evidence (file paths, commands, logs, screenshots, queries, or test IDs).
5. **Design:** produce `docs/02-target-architecture.md` using file `02`. Prefer the smallest compatible evolution; retain current stack unless replacement is justified and approved.
6. **Plan:** create a short prioritized backlog. Each change must name objective, affected components, data risk, tests, rollback, and acceptance evidence. Fix P0/P1 risks first.
7. **Implement incrementally:** make one bounded change at a time; preserve contracts, data, URLs, SEO, permissions, and integrations. Extract shared modules only where behavior is proven equivalent.
8. **Verify continuously:** run relevant tests after every change and the full feasible suite at milestones. Do not hide, delete, weaken, or skip failing tests without recorded approval.
9. **Release safely:** follow file `11`; validate migrations, backups, observability, health checks, canary/staging where available, and rollback rehearsal.
10. **Conclude:** generate all required documents and `docs/PLATFORM-READINESS-REPORT.md` from file `99`, including evidence, score, unresolved risks, and one verdict.

At every meaningful checkpoint, update both `docs/implementation-progress.md` and `.ai-dos/tasks/handoff.md`, then update the active task record without changing the repository's schema.

## Required progress report

Update `docs/implementation-progress.md` at each milestone:

```markdown
## YYYY-MM-DD HH:mm — Milestone
- Status: planned | in progress | blocked | verified
- Scope completed:
- Files/components changed:
- Data/schema impact: none | details
- Verification run and result:
- Retail flow impact:
- Wholesale flow impact:
- Security/SEO/performance impact:
- Rollback/checkpoint:
- Risks, unknowns, decisions needed:
- Next bounded action:
```

The AI-DOS handoff must additionally identify task/owner, branch/worktree, claimed files, commits or uncommitted state, decisions, checks and results, migrations/data impact, risks/blockers, rollback point, and exact next action.

Never claim verification without the command/check and result. Mark unavailable checks `NOT RUN` with reason and risk.

## Required acceptance criteria

- Existing public URLs either remain valid or use reviewed redirects with no important SEO loss.
- Existing production-compatible data is preserved; migrations are reversible or have a tested restore path.
- Retail: discovery → product detail → price/availability → cart → checkout → payment outcome → order confirmation/status works for guest/account paths as applicable.
- Wholesale: eligibility/authentication → customer-specific catalog/pricing/MOQ → order capture → approval/credit/payment path → fulfillment/status works as applicable.
- Shared inventory, reservation, tax, shipping, discount, payment, idempotency, cancellation, return/refund, and notification rules are consistent and tested where present.
- Authentication, authorization, secrets, validation, audit logging, dependency risk, and common web threats meet file `05`.
- Critical flows have automated coverage plus recorded manual acceptance; no open P0 and no unaccepted P1 defect.
- Build and release are reproducible; backup, restore, deploy, health check, monitoring, and rollback instructions are executable.
- Architecture and reusable modules are documented without implementing future-platform features.
- Final report is evidence-based and all score deductions map to actionable conditions.

## Prohibited actions

- No destructive production operations, force pushes, history rewrites, unreviewed bulk rewrites, or deletion of unknown/user changes.
- No live data migration, deployment, payment/refund, email/SMS blast, DNS change, secret rotation, or third-party account mutation without explicit authorization.
- No hard-coded secrets, production data in fixtures/logs/prompts, security-control bypass, fabricated test results, or silent error suppression.
- No breaking database/API/URL change without compatibility path, impact inventory, approval, tests, and rollback.
- No new framework or major dependency solely for preference; no speculative abstraction or premature platform extraction.
- No website-builder, multi-tenant runtime, tenant billing, page builder, or template marketplace implementation.
- No editing outside the declared/claimed file set until the task record is expanded and rechecked for conflicts.
- No parallel agent or developer may be assigned the same files without an explicit coordination record.

## Definition of Done

Done means both retail and wholesale critical journeys are verified end-to-end; accepted business rules are encoded and documented; P0/P1 issues are resolved or explicitly accepted by an authorized owner; tests and quality gates pass; production data/URLs/integrations remain protected; deployment and recovery are proven; required documents are current; and the final readiness report contains traceable evidence and a defensible verdict. “Code complete” alone is not done.

The active task must also be closed according to the existing AI-DOS schema, all claims released, and `.ai-dos/tasks/handoff.md` must contain a completion handoff with remaining work and rollback evidence.

## Stop conditions

Stop safely and request authorization when an action affects production/external users, irreversible data, financial transactions, secrets, DNS, or an unresolved business decision. Preserve progress and report the exact blocker, evidence, options, risks, and recommended next step. Ordinary test failures and uncertainty are not reasons to abandon the program: investigate and document them.

# Current System Audit Template

Create `docs/01-current-system-audit.md` with:

1. **Executive summary:** scope, date, commit, environments examined, confidence, top risks.
2. **Repository map:** apps/services/packages, owners, languages/frameworks/versions, build/deploy paths.
3. **Runtime topology:** clients, APIs, workers, databases, storage, cache, queue, search, CDN, third parties, trust boundaries.
4. **Environment matrix:** local/test/staging/production differences; configuration sources; never values of secrets.
5. **Domain map:** catalog, pricing, customer/account, inventory, cart/quote, checkout, order, payment, fulfillment, return/refund, content/SEO.
6. **Retail journey matrix** and **wholesale journey matrix:** entry, actors, preconditions, steps, dependencies, failures, current test/evidence.
7. **Data audit:** schema/migrations, ownership, identifiers, constraints, money/time handling, retention, backups, restore evidence, data-quality risks.
8. **Contract inventory:** URLs/routes, APIs, webhooks, events, imports/exports, scheduled jobs, integrations and consumers.
9. **Quality baseline:** exact build/lint/type/test commands and results; coverage where meaningful; flaky/missing tests.
10. **Security/operations/SEO/performance/accessibility:** findings with evidence.
11. **Duplication and reuse candidates:** current divergence, coupling, extraction risk; do not prescribe future SaaS.
12. **Risk register:** ID, severity, likelihood, impact, affected flow/data, evidence, owner, mitigation, acceptance status.
13. **Prioritized remediation backlog:** smallest safe sequence, dependencies, acceptance test, rollback.
14. **AI-DOS consistency audit:** applicable `AGENTS.md`; required read order; active tasks/claims; handoff state; architecture/decision/task documents that are missing, stale, contradicted, or verified.
15. **Work-state audit:** branch/worktree, dirty/untracked files, incomplete markers, recent relevant history, ownership, and safe boundaries. Do not interpret another owner's uncommitted work as obsolete.

Minimum audit coverage: authentication/authorization, admin access, catalog visibility, price calculation, inventory concurrency, order state machine, payment/webhook idempotency, refunds, personal data, logs, backups, dependency lifecycle, responsive/accessibility basics, canonical/indexing, and production observability.

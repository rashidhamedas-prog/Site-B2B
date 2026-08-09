# Target Architecture

The target is a stable, modular version of the existing system—not a new platform. Document current constraints before proposing changes.

## Principles

- Retain proven stack and deployment model unless evidence shows a blocking constraint.
- Separate presentation, application/use-case, domain policy, and infrastructure concerns using conventions natural to the current stack.
- Establish one authoritative implementation for shared commerce invariants; keep retail/wholesale policy differences explicit.
- Put external services behind narrow adapters; make time, IDs, currency, tax, shipping, payment, and notifications testable.
- Define ownership for data and writes. Avoid shared-table ambiguity and circular service dependencies.
- Use versioned contracts and compatibility layers for routes, APIs, events, and persisted states.

## Required architecture document

`docs/02-target-architecture.md` must show current and target component/data-flow diagrams, module boundaries, dependency rules, contract changes, data ownership, failure/idempotency strategy, observability, security boundaries, deployment topology, transition sequence, decisions (ADRs or equivalent), and rejected alternatives.

Before proposing the target, reconcile this document with AI-DOS architecture and decision records. List each verified, stale, superseded, missing, or conflicting record; create/update ADRs only within the claimed scope and repository convention.

Suggested bounded modules (adapt to evidence): Identity & Access; Customer/Account; Catalog; Pricing; Inventory; Cart/Quote; Checkout; Order; Payment; Fulfillment; Returns; Content/SEO; Notifications; Reporting. “Shared” means tested domain capability, not a generic dumping ground.

## Architecture acceptance

- Retail and wholesale differences can be located without scattered conditionals.
- Domain rules do not depend directly on UI or a payment/shipping vendor.
- Critical writes define transaction, retry, concurrency, and idempotency behavior.
- No new multi-tenant/page-builder concepts appear in runtime code.

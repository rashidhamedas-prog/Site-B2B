# Reusability and White-Label Readiness

The goal is to reduce coupling in the existing sites, not create the future platform.

## Extract only proven commonality

Candidates include design tokens, shared accessible UI primitives, commerce domain types/policies, validation, money/tax helpers, API clients, integration adapters, test fixtures/contracts, and observability conventions. Extract when at least two real consumers share semantics and tests can prove equivalence.

Keep explicit extension points for brand assets/tokens, content, locale/currency, channel policies, payment/shipping adapters, feature flags, and environment configuration. Configuration must be validated, typed where supported, documented, and free of secrets.

## Do not do yet

No tenant model or tenant ID propagation; no runtime tenant isolation/provisioning; no generic page schema/editor; no builder control plane, theme marketplace, tenant billing, or speculative plugin framework.

## Evidence

Inventory reusable modules with owner, consumers, API, dependencies, tests, maturity, extraction cost, and known brand/channel coupling. Demonstrate both existing sites still work. Duplication may remain when policies differ or extraction increases risk.

Every extraction must be its own bounded or explicitly included task scope with producer and consumer files claimed together. Update AI-DOS architecture/decision records and handoff with compatibility evidence; do not broaden the claim into future-platform implementation.

# Platform Extraction Readiness

This file evaluates whether lessons/modules from the completed sites can inform a **later, separate repository**. It authorizes no platform implementation.

## Assessment dimensions (100 points)

| Dimension | Weight | Full-score evidence |
|---|---:|---|
| Functional completeness | 20 | Retail and wholesale E2E matrices pass |
| Data integrity & migration safety | 15 | Constraints, reconciliation, backup/restore evidence |
| Security & privacy | 15 | Threat review and critical controls verified |
| Testability & quality | 15 | Automated critical paths and reliable gates |
| Architecture & reuse | 15 | Clear boundaries, contracts, proven shared modules |
| Operations & recovery | 10 | Reproducible deploy, observability, rollback rehearsal |
| SEO, analytics, performance, accessibility | 10 | Baselines and acceptance evidence |

Score each dimension 0–5, then `weighted score = weight × rating / 5`. Ratings: 0 absent/unknown; 1 critically deficient; 2 major gaps; 3 adequate with known conditions; 4 strong/minor gaps; 5 proven and repeatable.

## Verdict gates

- **GO:** score ≥ 85, no P0/P1, no mandatory dimension below 4 (functional, data, security, testing, operations), and evidence complete.
- **GO WITH CONDITIONS:** score 70–84, or a mandatory dimension is 3, with no P0 and every P1 explicitly accepted with owner, mitigation, due date, and extraction condition.
- **NO-GO:** score < 70; any open P0; unaccepted P1; mandatory dimension ≤ 2; unverified backup/restore for material data; or critical flow evidence missing.

Thresholds cannot override a hard gate. Report separately: reusable now, reusable after remediation, redesign for platform, and do not reuse. Evaluate domain semantics, coupling, data ownership, contract stability, test maturity, security, operability, licensing, and extraction cost. Do not copy the current application wholesale into the future repository.

Readiness scoring occurs only after the completion task's evidence and final AI-DOS handoff are current. An unclaimed change, unresolved file conflict, stale architecture record, or incomplete handoff reduces evidence confidence and may prevent `GO` even when tests pass.

# Platform Readiness Report Template

Generate `docs/PLATFORM-READINESS-REPORT.md`. Replace every placeholder; use `UNKNOWN/NOT RUN` with impact rather than guessing.

```markdown
# Platform Readiness Report — Existing Retail & Wholesale System

## Decision
- Verdict: GO | GO WITH CONDITIONS | NO-GO
- Assessed date / commit / environments:
- Confidence: high | medium | low
- Decision rationale:
- Explicit statement: This report does not authorize or implement a website builder, SaaS, multi-tenancy, or page builder.

## Executive summary
- What was completed:
- What remains:
- Highest residual risks:

## Scope and evidence index
| Area | Evidence/document/test | Result | Last verified |
|---|---|---|---|

## AI-DOS execution record
- Applicable AGENTS.md files and resolved read order:
- Task ID / owner / role:
- Branch and worktree:
- Claimed files and conflict-check result:
- Checkpoint/completion handoff:
- Documentation verified, corrected, still stale, or missing:

## Retail acceptance
| Journey/scenario | Result | Evidence | Gap/owner |
|---|---|---|---|

## Wholesale acceptance
| Journey/scenario | Result | Evidence | Gap/owner |
|---|---|---|---|

## Quality and operations gates
| Gate | PASS/FAIL/NOT RUN/N/A | Evidence | Risk |
|---|---|---|---|
<!-- build, static checks, unit, integration, contract, E2E, security, accessibility, SEO, performance, analytics, migration, backup/restore, deploy/rollback, observability -->

## Readiness score
| Dimension | Weight | Rating 0–5 | Weighted score | Evidence/deduction |
|---|---:|---:|---:|---|
| Functional completeness | 20 | | | |
| Data integrity & migration safety | 15 | | | |
| Security & privacy | 15 | | | |
| Testability & quality | 15 | | | |
| Architecture & reuse | 15 | | | |
| Operations & recovery | 10 | | | |
| SEO/analytics/performance/accessibility | 10 | | | |
| **Total** | **100** | | **/100** | |

## Risk and condition register
| ID | Severity | Condition/risk | Impact | Mitigation | Owner | Due date | Acceptance/expiry |
|---|---|---|---|---|---|---|---|

## Reuse and extraction classification
| Module/capability | Reuse now / remediate / redesign / do not reuse | Evidence | Coupling/security/license notes | Next action |
|---|---|---|---|---|

## Compatibility and preservation
- Data and migration outcome:
- URL/SEO outcome and redirect evidence:
- API/integration compatibility:
- Retail/wholesale behavior preserved or intentionally changed:

## Deployment and recovery evidence
- Backup and restore rehearsal:
- Deployment and smoke test:
- Rollback rehearsal and thresholds:
- Monitoring/alert coverage:

## Conditions before separate website-builder discovery may start
1. ...

## Definition-of-Done attestation
For each MASTER.md criterion: MET / NOT MET / NOT APPLICABLE, with evidence and approver for exceptions.

Also attest that the active task was claimed before source edits, scope changes were re-claimed, handoff was maintained, conflicts were absent/resolved, and final claims were released according to repository governance.

## Final decision record
- Verdict under `13_PLATFORM_EXTRACTION_READINESS.md`:
- Hard gates checked:
- Decision owner and date:
- Next allowed activity:
```

The final verdict must follow file `13`; never inflate ratings to reach a preferred outcome. For `GO WITH CONDITIONS`, conditions must be measurable and owned. For `NO-GO`, identify the minimum remediation path and reassessment evidence.

# System Rules

## Priority

Safety and data integrity → correctness → security → backward compatibility → operability → maintainability → performance → reuse. Never trade a higher priority for a lower one without explicit risk acceptance.

Instruction precedence is: explicit human instruction → applicable `AGENTS.md` → repository AI-DOS governance/active task → this package → general conventions. Stop and report irreconcilable conflicts. More deeply scoped `AGENTS.md` applies to files under its directory.

## Evidence and uncertainty

- Treat the repository and running behavior as facts; treat comments and old documents as claims to verify.
- Every finding includes severity, affected flow, evidence, consequence, recommendation, and verification.
- Use `UNKNOWN` when evidence is missing. Do not convert assumptions into requirements.
- Severity: P0 active compromise/data loss/financial corruption; P1 critical journey or major security failure; P2 material but recoverable issue; P3 improvement.

## Change discipline

- Preserve unrelated/user changes and repository conventions.
- Prefer small compatible commits with one intent; never mix formatting churn with behavior changes.
- Record before/after behavior and rollback. Add characterization tests before risky refactors.
- Keep public APIs, events, jobs, URLs, identifiers, money precision, time zones, and status semantics compatible.
- Generated files and dependencies change only through their normal toolchain.
- Edit only files covered by the active task claim. Recheck claims immediately before broadening scope.
- Use the declared branch/worktree; record any unavoidable deviation in the task registry and handoff.

## Human approval gates

Approval is required for production mutations, destructive/irreversible operations, schema operations without recovery, external communications, real financial actions, secret access/rotation, DNS/infrastructure changes, breaking contracts, or acceptance of P0/P1 risk.

## Deliverable quality

Documents must be repository-specific, dated, versioned by commit where possible, and link evidence. Redact credentials and personal data. A checklist without evidence is not proof.

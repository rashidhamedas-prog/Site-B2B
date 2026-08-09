# Testing, QA, and Acceptance

## Test strategy

- Unit: pure domain rules, money/rounding, pricing precedence, permissions, state guards.
- Integration: database constraints/transactions, adapters, queues/jobs, cache, search, payment/webhook contracts.
- Contract: internal/public APIs, events, webhooks, imports/exports and compatibility.
- E2E: retail and wholesale matrices in files `06` and `07`, including failure/retry paths.
- Non-functional: security, accessibility, SEO, performance, backup/restore, deployment/rollback.

Use deterministic isolated test data; never use real payments or notify real users. Mock at external boundaries, but retain sandbox/staging contract checks. Control clock/randomness and make concurrency tests explicit.

## Quality gates

- Build, lint, formatting check, type/static analysis, migration validation, and relevant tests pass using repository commands.
- Changed critical behavior has regression tests; critical-flow coverage is meaningful, not a percentage game.
- No open P0; no P1 without named owner, written acceptance, expiry, mitigation, and verdict impact.
- Flaky tests are fixed or quarantined transparently with owner/date; never silently rerun to manufacture green.
- Manual QA records environment/build, data, steps, expected/actual, evidence, tester/date, and defect links.

Create `docs/test-and-acceptance-evidence.md` with a requirement-to-test-to-result traceability matrix. `PASS` requires evidence; use `FAIL`, `NOT RUN`, or `NOT APPLICABLE` honestly.

During preflight, discover quality commands from repository documentation, manifests, task runners, CI workflows, container definitions, and scripts. Record command, working directory, prerequisites, environment, purpose, and whether it was actually executed. Do not substitute guessed generic commands for repository-defined ones.

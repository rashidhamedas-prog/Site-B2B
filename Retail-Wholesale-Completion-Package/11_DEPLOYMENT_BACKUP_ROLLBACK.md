# Deployment, Backup, and Rollback

Create `docs/deployment-runbook.md` tailored to the repository.

## Release readiness

Record artifact/commit, dependency lock, configuration keys (not values), environment parity, migrations/backfills, feature flags, third-party/sandbox checks, capacity, monitoring, owner, window, and communication plan. Confirm a recent usable backup and restore procedure before data-affecting release.

## Runbook sequence

1. Preflight health and baseline metrics.
2. Backup/checkpoint and verified recovery metadata.
3. Compatible migration/expand step.
4. Staged/canary deployment where supported.
5. Smoke retail, wholesale, admin, job, webhook, and observability paths without real financial/user impact.
6. Observe defined metrics/logs/traces for a stated window.
7. Proceed or rollback using objective thresholds.

Define rollback triggers for error rate, latency, payment/order/inventory mismatch, authorization failure, job backlog, SEO routing, and data reconciliation. Application rollback must account for schema compatibility. If rollback cannot restore data correctness, stop and execute the approved recovery/forward-fix plan. Rehearse restore and rollback in a safe environment and record time/RPO/RTO evidence.

The active task and handoff must point to the precise recovery checkpoint (commit/artifact/migration/backup reference), rollback owner, trigger, and verification. Never record secret values or sensitive backup locations accessible beyond authorized operators.

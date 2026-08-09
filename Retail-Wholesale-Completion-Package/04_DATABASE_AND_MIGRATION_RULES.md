# Database and Migration Rules

## Before change

Inventory every datastore, schema tool, migration history, writer, replica/cache/search projection, retention rule, and backup/restore process. Profile data with privacy-safe aggregates. Check nulls, duplicates, orphan records, invalid states, currency precision, time zones, and identifier collisions.

## Migration contract

- Prefer expand → backfill → verify → switch reads/writes → contract later.
- Make migrations deterministic, versioned, reviewable, observable, bounded, and safe to retry where possible.
- Never assume empty tables or perfect historical data. Estimate locks, duration, storage, and replication impact.
- Preserve referential and business invariants at the strongest practical layer.
- Backfills need checkpoints, throttling, reconciliation counts, failure resume, and audit trail.
- A reversible migration needs a tested down path; an irreversible one needs a tested backup restore and explicit approval.
- Application rollout must tolerate mixed versions during deployment/rollback.

## Evidence

Record pre/post schema, row/reconciliation counts, performance impact, test on production-like volume, backup ID/time (never credentials), restore rehearsal, rollout/rollback commands, and responsible approver. Production execution is outside autonomous scope.

Database/schema/migration/backfill files and their application consumers must be explicitly claimed in the active task. Record migration checkpoints and recovery state in `.ai-dos/tasks/handoff.md` before and after every migration milestone.

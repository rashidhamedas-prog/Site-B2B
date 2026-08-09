# Development and Git Rules

- Inspect repository instructions, status, branches, remotes, hooks, CI, package managers, lockfiles, and supported runtimes first.
- Work on an isolated named branch; do not overwrite local changes. Commit only scoped files when commits are authorized.
- Before editing, read `.ai-dos/tasks/active.yaml`, establish a non-overlapping claim in its existing schema, and record branch/worktree and owner. A claim is a coordination lock, not permission for destructive or production action.
- Before each risky change capture baseline, affected contracts/data, recovery point, and verification plan.
- Prefer characterization test → smallest change → focused verification → full relevant suite → documented result.
- Preserve formatting/style conventions. Avoid mass rename, broad reformat, dependency upgrade, and refactor in the same change.
- New dependencies require need, maintenance/security/license review, version pinning consistent with the stack, and rollback.
- Commit messages state intent and impact; never commit secrets, dumps, generated credentials, or personal data.
- Never force-push, rewrite shared history, merge, tag, publish, or deploy unless explicitly authorized.
- Keep `.ai-dos/tasks/handoff.md` current at preflight, checkpoints, blockers, transfers, and completion. Close/release the task and claims using the repository's established state transitions.

Each change record must answer: why now, what behavior changes, what remains compatible, how it was tested, data/security impact, and how to revert.

## Claim conflict procedure

Normalize paths according to repository conventions and check exact files plus overlapping directories/globs. On conflict: do not edit; report task IDs, owners, overlapping paths, and safe options (wait, split, coordinate, or transfer). Never delete or rewrite another task entry to unblock yourself.

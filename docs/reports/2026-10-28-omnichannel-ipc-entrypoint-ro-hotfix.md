# Hotfix: API crash-loop on `/ipc:ro` after #128 (2026-10-28)

## Symptom

Production API containers restart-loop after merge of #128. Entrypoint never reaches `su-exec` / `node`.

## Root cause

`apps/api/docker-entrypoint.sh` used `[ -w /ipc ]` before `chown`. On Linux, **root often sees `-w` as true even on Docker `:ro` mounts**. API mounts `omnichannel_ipc:/ipc:ro`. Then:

1. `[ -w /ipc ]` succeeds
2. `chown -R taranom:taranom /ipc` fails with `Read-only file system`
3. `set -eu` exits the script
4. Process never starts → crash-loop

Squash of #128 either lost or never landed a real writability probe (touch).

Secondary risk: for some Compose v2 setups, `command: ['node', 'dist/worker.main']` on worker services was observed as replacing the image ENTRYPOINT (`Entrypoint=[node,dist/worker.main]`), so workers skipped `docker-entrypoint.sh` entirely (no chown on rw `/ipc`).

## Fix

| File | Change |
| --- | --- |
| `apps/api/docker-entrypoint.sh` | Probe with `touch /ipc/.ipc-write-probe 2>/dev/null` then `rm`; **only then** `chown`/`chmod`. On probe failure, skip chown and still `su-exec`. |
| `docker-compose.yml` | `worker` and `worker-b`: explicit `entrypoint: ['/usr/local/bin/docker-entrypoint.sh']` + `command: ['node', 'dist/worker.main']`. |

No migration. No connector flags. No live send. Branch: `fix/omnichannel-ipc-entrypoint-ro`.

## Rollback

Revert this PR / redeploy prior image. Temporary ops workaround without this fix: override API entrypoint to skip chown, or remount `/ipc` rw only for a one-shot chown (not preferred).

## Verify after GO + deploy

- API: `docker compose ps api` Up (not Restarting); `GET /v1/health` 200.
- Entrypoint logs: no EROFS from chown on API.
- Worker inspect: Entrypoint includes `docker-entrypoint.sh`, Cmd `node dist/worker.main`.
- Worker heartbeat under `/ipc` writable by `taranom`.

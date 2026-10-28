# Omnichannel `/ipc` entrypoint chown (2026-10-28)

## Gap

PR #122 added a post-`compose up` `chown` in `scripts/auto-deploy.sh` so the named volume `omnichannel_ipc` (mounted at `/ipc`) is writable by `taranom`. That only runs on deploy via that script. Container start itself still left `/ipc` root-owned on first create or when the deploy helper was skipped — worker heartbeat/drain then hit `Permission denied` and admin health stayed stale.

## Fix

| Layer | Change |
| --- | --- |
| `apps/api/docker-entrypoint.sh` | If root and `/ipc` exists and is writable: `chown -R taranom:taranom /ipc` + `chmod 775`, then `exec su-exec taranom "$@"`. If already non-root: skip chown and `exec "$@"`. Skip chown on `:ro` mounts (API). |
| `apps/api/Dockerfile` | Install Alpine `su-exec`; `COPY` entrypoint; remove `USER taranom`; `ENTRYPOINT` keeps root until drop. Same image for API CMD and worker `command`. |
| `scripts/auto-deploy.sh` | Keep deploy-time chown as defense-in-depth; run **before** worker up; **fail loudly** on error (no silent `\|\| true`). |

No migration. No connector flags. No Telegram/Bale/Rubika live send.

## Rollback

Revert this commit (or redeploy prior image). Deploy script chown alone can still fix a live volume; containers without entrypoint need that path or a one-shot `docker run --user 0` chown.

## Verify after GO + deploy

- Worker logs: heartbeat writes under `/ipc` without EACCES.
- `GET /v1/omnichannel/health` (admin) shows fresh heartbeat age.
- `docker compose exec worker id` → uid of `taranom`, not root.

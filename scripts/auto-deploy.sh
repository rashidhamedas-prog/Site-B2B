#!/bin/bash
# ============================================================================
# Taranom server-side auto-deploy (poll origin/master, rebuild on change).
# Installed as a systemd oneshot service driven by taranom-autodeploy.timer.
# Safe to run repeatedly: it only rebuilds when origin/master advances, holds
# a deploy lock (owner metadata + stale detection) so runs never overlap, and
# leaves the running containers untouched if the build fails.
#
# Deploy gate: requires $APP_DIR/deploy-approval.json with exact commit + goRef.
# TARANOM_DEPLOY_FORCE=1 does NOT bypass the gate. Approval is consumed after
# a successful deploy. Worker soft-drains (no new claims) up to 120s before
# recreate; on drain timeout deploy aborts and the worker is left running.
#
# After git reset, the script re-execs itself so newly pulled deploy steps
# actually run — bash does not re-read a script mid-run.
# GitHub Actions must call this same script (shared deploy-lock). No safety-net SQL.
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/taranom}"
APPROVAL_FILE="${TARANOM_DEPLOY_APPROVAL_FILE:-$APP_DIR/deploy-approval.json}"
DEPLOY_LOG="${TARANOM_DEPLOY_LOG:-$APP_DIR/logs/deploy.log}"
DRAIN_TIMEOUT_SEC="${TARANOM_DEPLOY_DRAIN_TIMEOUT_SEC:-120}"
GATE_PY="$APP_DIR/scripts/lib/deploy-gate.py"

cd "$APP_DIR"

# Prevent overlapping deploys (with the GitHub Actions deploy or a previous run).
# Owner file + stale takeover (dead PID / max-age without build child); see lib/deploy-lock.sh.
# shellcheck source=lib/deploy-lock.sh
source "$APP_DIR/scripts/lib/deploy-lock.sh"
if ! deploy_lock_acquire "$(git rev-parse HEAD 2>/dev/null || echo unknown)"; then
  echo "$(date -Is) another deploy is running — skipping"
  exit 0
fi
trap deploy_lock_release EXIT

require_gate() {
  if ! command -v python3 >/dev/null 2>&1; then
    echo "$(date -Is) ERROR: python3 is required for deploy-approval gate"
    exit 1
  fi
  if [ ! -f "$GATE_PY" ]; then
    echo "$(date -Is) ERROR: missing deploy gate helper: $GATE_PY"
    exit 1
  fi
}

# Soft-drain worker: stop new claims, wait for in-flight sends. Never SIGKILL.
drain_worker_or_abort() {
  local timeout="${1:-$DRAIN_TIMEOUT_SEC}"
  local worker_ctr="${TARANOM_WORKER_CONTAINER:-taranom_worker}"
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$worker_ctr"; then
    echo "$(date -Is) worker container not running — skip drain"
    return 0
  fi

  # Prefer paths from the *running* container (old image may still use /tmp; compose uses /ipc).
  local drain_flag drained_flag
  drain_flag="$(docker exec "$worker_ctr" printenv OMNICHANNEL_WORKER_DRAIN 2>/dev/null || true)"
  drained_flag="$(docker exec "$worker_ctr" printenv OMNICHANNEL_WORKER_DRAINED 2>/dev/null || true)"
  drain_flag="${drain_flag:-${OMNICHANNEL_WORKER_DRAIN:-/tmp/omnichannel-worker.drain}}"
  drained_flag="${drained_flag:-${OMNICHANNEL_WORKER_DRAINED:-/tmp/omnichannel-worker.drained}}"

  echo "$(date -Is) requesting worker soft-drain (timeout=${timeout}s path=${drain_flag})..."
  docker exec "$worker_ctr" rm -f "$drained_flag" >/dev/null 2>&1 || true
  if ! docker exec "$worker_ctr" touch "$drain_flag" >/dev/null 2>&1; then
    echo "$(date -Is) WARNING: could not signal drain; aborting without killing worker"
    exit 1
  fi

  local i
  for i in $(seq 1 "$timeout"); do
    if docker exec "$worker_ctr" test -f "$drained_flag" >/dev/null 2>&1; then
      echo "$(date -Is) worker drained after ${i}s"
      return 0
    fi
    sleep 1
  done

  echo "$(date -Is) ERROR: worker drain timed out after ${timeout}s — deploy aborted; worker left running"
  docker exec "$worker_ctr" rm -f "$drain_flag" >/dev/null 2>&1 || true
  exit 1
}

consume_approval() {
  local commit="$1"
  local go_ref="$2"
  require_gate
  python3 "$GATE_PY" consume-approval \
    --file "$APPROVAL_FILE" \
    --log "$DEPLOY_LOG" \
    --commit "$commit" \
    --go-ref "$go_ref"
}

# Phase A: detect update, verify approval, pull, re-exec into Phase B
if [ "${TARANOM_DEPLOY_BUILD:-}" != "1" ]; then
  git fetch origin master -q
  LOCAL="$(git rev-parse HEAD)"
  REMOTE="$(git rev-parse origin/master)"

  if [ "$LOCAL" = "$REMOTE" ] && [ "${TARANOM_DEPLOY_FORCE:-}" != "1" ]; then
    echo "$(date -Is) already up to date (${LOCAL:0:7})"
    exit 0
  fi

  require_gate
  echo "$(date -Is) checking deploy approval for ${REMOTE:0:12} (FORCE cannot bypass)..."
  APPROVAL_JSON="$(python3 "$GATE_PY" assert-approval \
    --file "$APPROVAL_FILE" \
    --commit "$REMOTE" \
    --force "${TARANOM_DEPLOY_FORCE:-0}")"
  TARANOM_DEPLOY_GO_REF="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["goRef"])' "$APPROVAL_JSON")"
  export TARANOM_DEPLOY_GO_REF
  export TARANOM_DEPLOY_TARGET_COMMIT="$REMOTE"

  echo "$(date -Is) new revision detected: ${LOCAL:0:7} -> ${REMOTE:0:7} (goRef=${TARANOM_DEPLOY_GO_REF})"
  git reset --hard origin/master
  export TARANOM_DEPLOY_BUILD=1
  exec /bin/bash "$APP_DIR/scripts/auto-deploy.sh"
fi

# Phase B: drain → build + schema + health (always runs from the just-pulled script)
if [ -f "$APP_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env"
  set +a
fi

TARGET_COMMIT="${TARANOM_DEPLOY_TARGET_COMMIT:-$(git rev-parse HEAD)}"
GO_REF="${TARANOM_DEPLOY_GO_REF:-}"
if [ -z "$GO_REF" ]; then
  require_gate
  APPROVAL_JSON="$(python3 "$GATE_PY" assert-approval --file "$APPROVAL_FILE" --commit "$TARGET_COMMIT" --force "${TARANOM_DEPLOY_FORCE:-0}")"
  GO_REF="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["goRef"])' "$APPROVAL_JSON")"
fi

drain_worker_or_abort "$DRAIN_TIMEOUT_SEC"

echo "$(date -Is) building images..."
# worker-b stays off: dual workers raced CREATE sends before atomic claim; keep one worker.
docker compose build api web worker

echo "$(date -Is) starting containers..."
docker compose up -d api web worker
docker compose stop worker-b >/dev/null 2>&1 || true
# Shared omnichannel_ipc is root-owned on first create; worker runs as taranom (uid 100)
# and must write heartbeat/drain under /ipc (else health stays stale / Permission denied).
echo "$(date -Is) ensuring /ipc volume writable by taranom..."
docker run --rm --user 0 --entrypoint /bin/sh \
  -v taranom_omnichannel_ipc:/ipc \
  taranom-worker \
  -c 'chown -R taranom:taranom /ipc 2>/dev/null || chown -R 100:101 /ipc; chmod 775 /ipc' \
  >/dev/null 2>&1 || true
# Force-recreate nginx: single-file bind of nginx.conf goes stale on inode replace
# (git reset / rewrite); `up -d` alone can keep the old inode. Also remounts conf.d.
docker compose up -d nginx --no-deps --force-recreate

echo "$(date -Is) schema is TypeORM migrations only (no safety-net SQL)"

echo "$(date -Is) waiting for API health..."
ok=0
for _ in $(seq 1 24); do
  if curl -sf http://localhost:4000/v1/health >/dev/null; then ok=1; break; fi
  sleep 5
done
if [ "$ok" != "1" ]; then
  echo "$(date -Is) WARNING: API health check did not pass"
  docker compose logs --tail 40 api || true
  exit 1
fi

echo "$(date -Is) deploy complete at $(git rev-parse --short HEAD)"
consume_approval "$TARGET_COMMIT" "$GO_REF"
echo "$(date -Is) approval consumed; logged to $DEPLOY_LOG"

# Every build leaves cache and the previous images behind; on a 38G disk that ran out mid-build.
# Keep 3G of warm cache for fast rebuilds; dangling images only (tagged images stay).
docker builder prune -f --max-used-space 3g >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true
echo "$(date -Is) disk after cleanup: $(df -h / | awk 'NR==2 {print $4 " free (" $5 " used)"}')"

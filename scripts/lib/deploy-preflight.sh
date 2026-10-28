#!/bin/bash
# ============================================================================
# Read-only deploy preflight helpers (phase-2 runbook / tests).
# Does not write or repair deploy-approval.json.
# ============================================================================

: "${APP_DIR:=/opt/taranom}"
: "${GATE_PY:=$APP_DIR/scripts/lib/deploy-gate.py}"
: "${TARANOM_DEPLOY_LOCK_FILE:=/tmp/taranom-autodeploy.lock}"

validate_approval_file() {
  # Usage: validate_approval_file <path> <full-sha>
  # Prints short sha + goRef length only; never dumps secrets.
  local path="$1"
  local sha="$2"
  if [ ! -s "$path" ]; then
    echo "STOP: approval missing/empty"
    return 1
  fi
  if ! python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert isinstance(d,dict)' "$path" 2>/dev/null; then
    echo "STOP: approval invalid JSON"
    return 1
  fi
  if [ ! -f "$GATE_PY" ]; then
    echo "STOP: missing deploy-gate.py"
    return 1
  fi
  local out
  if ! out="$(python3 "$GATE_PY" assert-approval --file "$path" --commit "$sha" --force 0 2>/dev/null)"; then
    echo "STOP: approval assert failed for ${sha:0:12}"
    return 1
  fi
  local go
  go="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("goRef",""))' "$out")"
  echo "APPROVAL_OK commit=${sha:0:12} goRef_len=${#go}"
  return 0
}

check_no_running_deploy() {
  # 0 = clear to deploy; 1 = another deploy appears active.
  if pgrep -af 'auto-deploy\.sh' >/dev/null 2>&1; then
    echo "STOP: another auto-deploy.sh process is running"
    return 1
  fi
  : >>"$TARANOM_DEPLOY_LOCK_FILE" 2>/dev/null || true
  # Probe with a temporary fd only (do not hold).
  if ! flock -n "$TARANOM_DEPLOY_LOCK_FILE" -c true 2>/dev/null; then
    echo "STOP: deploy lock is held"
    return 1
  fi
  echo "LOCK_FREE"
  return 0
}

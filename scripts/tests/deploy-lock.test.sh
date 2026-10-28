#!/bin/bash
# TAP-like unit tests for scripts/lib/deploy-lock.sh (no Docker).
# shellcheck disable=SC1091,SC2317,SC2015,SC2012,SC2034
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=../lib/deploy-lock.sh
source "$ROOT/scripts/lib/deploy-lock.sh"

PASS=0
FAIL=0

ok() {
  PASS=$((PASS + 1))
  echo "ok $PASS - $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo "not ok $((PASS + FAIL)) - $1"
  echo "# $2"
}

assert_eq() {
  local label="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then
    ok "$label"
  else
    fail "$label" "got='$got' want='$want'"
  fi
}

assert_contains() {
  local label="$1" hay="$2" needle="$3"
  case "$hay" in
    *"$needle"*) ok "$label" ;;
    *) fail "$label" "missing '$needle' in: $hay" ;;
  esac
}

with_tmpdir() {
  local dir rc
  dir="$(mktemp -d)"
  export TARANOM_DEPLOY_LOCK_FILE="$dir/lock"
  export TARANOM_DEPLOY_LOCK_MAX_AGE=2700
  export TARANOM_DEPLOY_LOCK_PROC_ROOT="/proc"
  "$@"
  rc=$?
  rm -rf "$dir"
  return "$rc"
}

write_owner() {
  local pid="$1" started="$2"
  cat >"${TARANOM_DEPLOY_LOCK_FILE}.owner" <<EOF
pid=${pid}
started=${started}
host=test-host
commit=deadbeefcafe
EOF
}

# --- 1. dead PID ---
test_dead_pid() {
  with_tmpdir _test_dead_pid_body
}
_test_dead_pid_body() {
  write_owner 999999 $(($(date +%s) - 10))
  local out rc=0
  out="$(deploy_lock_acquire testcommit 2>&1)" || rc=$?
  assert_eq "dead PID acquire exit" "$rc" "0"
  assert_contains "dead PID log reason" "$out" "reason=dead-pid old_pid=999999"
  [ -f "${TARANOM_DEPLOY_LOCK_FILE}.owner" ] && ok "dead PID owner rewritten" || fail "dead PID owner rewritten" "missing owner"
  deploy_lock_release
}

# --- 2. old lock, no build child ---
test_old_no_build() {
  with_tmpdir _test_old_no_build_body
}
_test_old_no_build_body() {
  sleep 120 &
  local spid=$!
  write_owner "$spid" $(($(date +%s) - 4000))
  local out rc=0
  out="$(deploy_lock_acquire testcommit 2>&1)" || rc=$?
  assert_eq "old no-build acquire exit" "$rc" "0"
  assert_contains "old no-build reason" "$out" "reason=max-age-no-build-child"
  kill "$spid" 2>/dev/null || true
  wait "$spid" 2>/dev/null || true
  deploy_lock_release
}

# --- 3. old lock with build child ---
test_old_with_build() {
  with_tmpdir _test_old_with_build_body
}
_test_old_with_build_body() {
  # Parent shell; child argv0 looks like docker build.
  bash -c 'sleep 60' &
  local parent=$!
  # Give parent a moment, then spawn build-named child under it via a helper that
  # re-parents: run a subshell as the "holder" that both owns the lock pid and
  # has a docker-build-named child.
  local holder_script child_pid
  holder_script="$(mktemp)"
  cat >"$holder_script" <<'EOS'
#!/bin/bash
# Stay alive as lock holder; spawn build-named child.
(exec -a "docker build ." sleep 60) &
echo $! >"${1}.child"
sleep 60
EOS
  chmod +x "$holder_script"
  bash "$holder_script" "$holder_script" &
  local holder=$!
  # Wait for child pid file
  local i child=""
  for i in $(seq 1 50); do
    if [ -f "${holder_script}.child" ]; then
      child="$(cat "${holder_script}.child")"
      break
    fi
    sleep 0.05
  done
  kill "$parent" 2>/dev/null || true
  if [ -z "$child" ] || ! kill -0 "$child" 2>/dev/null; then
    fail "old with-build setup" "could not start docker-build child"
    kill "$holder" 2>/dev/null || true
    rm -f "$holder_script" "${holder_script}.child"
    return 0
  fi
  write_owner "$holder" $(($(date +%s) - 4000))
  local rc=0
  deploy_lock_acquire testcommit >/dev/null 2>&1 || rc=$?
  assert_eq "old with-build kept (acquire=1)" "$rc" "1"
  kill "$holder" "$child" 2>/dev/null || true
  wait "$holder" 2>/dev/null || true
  wait "$child" 2>/dev/null || true
  rm -f "$holder_script" "${holder_script}.child"
}

# --- 4. healthy fresh lock ---
test_fresh_healthy() {
  with_tmpdir _test_fresh_healthy_body
}
_test_fresh_healthy_body() {
  sleep 60 &
  local spid=$!
  write_owner "$spid" "$(date +%s)"
  local rc=0
  deploy_lock_acquire testcommit >/dev/null 2>&1 || rc=$?
  assert_eq "fresh lock kept (acquire=1)" "$rc" "1"
  kill "$spid" 2>/dev/null || true
  wait "$spid" 2>/dev/null || true
}

# --- 5. concurrent stale takeover ---
test_concurrent() {
  with_tmpdir _test_concurrent_body
}
_test_concurrent_body() {
  write_owner 999998 $(($(date +%s) - 10))
  local barrier="$TARANOM_DEPLOY_LOCK_FILE.barrier"
  local hold="$TARANOM_DEPLOY_LOCK_FILE.hold"
  local results="$TARANOM_DEPLOY_LOCK_FILE.results"
  mkdir -p "$results"
  : >"$barrier"
  : >"$hold"
  local i
  for i in $(seq 1 10); do
    (
      # Wait until barrier removed
      while [ -f "$barrier" ]; do sleep 0.01; done
      rc=0
      deploy_lock_acquire "c$i" >/dev/null 2>&1 || rc=$?
      echo "$rc $BASHPID" >"$results/$i"
      # Winner keeps owner until parent drops hold (so losers observe a live lock).
      if [ "$rc" = "0" ]; then
        while [ -f "$hold" ]; do sleep 0.05; done
        deploy_lock_release
      fi
    ) &
  done
  sleep 0.2
  rm -f "$barrier"
  # Wait until all 10 attempts recorded
  for i in $(seq 1 100); do
    if [ "$(ls -1 "$results" 2>/dev/null | wc -l)" -eq 10 ]; then
      break
    fi
    sleep 0.05
  done
  local winners=0 losers=0 rc pid
  for i in $(seq 1 10); do
    read -r rc pid <"$results/$i"
    if [ "$rc" = "0" ]; then
      winners=$((winners + 1))
    else
      losers=$((losers + 1))
    fi
  done
  rm -f "$hold"
  wait || true
  assert_eq "concurrent exactly one winner" "$winners" "1"
  assert_eq "concurrent nine losers" "$losers" "9"
}

# --- 6. release only by owner ---
test_release_owner_only() {
  with_tmpdir _test_release_owner_only_body
}
_test_release_owner_only_body() {
  deploy_lock_acquire mine >/dev/null
  local owner_pid
  owner_pid="$(sed -n 's/^pid=//p' "${TARANOM_DEPLOY_LOCK_FILE}.owner")"
  assert_eq "owner is self" "$owner_pid" "$BASHPID"
  # Foreign release attempt in a subshell must not delete owner
  bash -c "
    source '$ROOT/scripts/lib/deploy-lock.sh'
    export TARANOM_DEPLOY_LOCK_FILE='$TARANOM_DEPLOY_LOCK_FILE'
    deploy_lock_release
  "
  [ -f "${TARANOM_DEPLOY_LOCK_FILE}.owner" ] && ok "foreign release kept owner" || fail "foreign release kept owner" "owner removed"
  deploy_lock_release
  [ ! -f "${TARANOM_DEPLOY_LOCK_FILE}.owner" ] && ok "owner release removed file" || fail "owner release removed file" "still present"
}

echo "1..12"
test_dead_pid
test_old_no_build
test_old_with_build
test_fresh_healthy
test_concurrent
test_release_owner_only

echo "# passed=$PASS failed=$FAIL"
if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
exit 0

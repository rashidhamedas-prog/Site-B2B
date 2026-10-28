#!/bin/bash
# TAP-like unit tests for deploy-lock v2 (no Docker).
# shellcheck disable=SC1091,SC2317,SC2015,SC2012,SC2034
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=../lib/deploy-lock.sh
source "$ROOT/scripts/lib/deploy-lock.sh"
# shellcheck source=../lib/deploy-preflight.sh
source "$ROOT/scripts/lib/deploy-preflight.sh"
# shellcheck source=../lib/compose-created-check.sh
source "$ROOT/scripts/lib/compose-created-check.sh"

PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok $PASS - $1"; }
fail() { FAIL=$((FAIL + 1)); echo "not ok $((PASS + FAIL)) - $1"; echo "# $2"; }
assert_eq() {
  local label="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then ok "$label"; else fail "$label" "got='$got' want='$want'"; fi
}
assert_contains() {
  local label="$1" hay="$2" needle="$3"
  case "$hay" in *"$needle"*) ok "$label" ;; *) fail "$label" "missing '$needle' in: $hay" ;; esac
}

with_tmpdir() {
  local dir rc
  dir="$(mktemp -d)"
  export TARANOM_DEPLOY_LOCK_FILE="$dir/lock"
  export TARANOM_DEPLOY_LOCK_MAX_AGE=2700
  export TARANOM_DEPLOY_LOCK_PROC_ROOT="/proc"
  unset TARANOM_DEPLOY_LOCK_HELD_BY || true
  # Clear any traps left by prior cases in this shell.
  trap - EXIT INT TERM HUP
  # Drop a leftover lock fd from a previous acquire in this shell.
  if { true >&9; } 2>/dev/null; then
    flock -u 9 2>/dev/null || true
    exec 9>&- 2>/dev/null || true
  fi
  "$@"
  rc=$?
  trap - EXIT INT TERM HUP
  if { true >&9; } 2>/dev/null; then
    flock -u 9 2>/dev/null || true
    exec 9>&- 2>/dev/null || true
  fi
  rm -rf "$dir"
  return "$rc"
}

# Run acquire in-process (not in $()) so BASHPID matches for release.
acquire_log() {
  local log="$1" commit="${2:-testcommit}"
  : >"$log"
  set +e
  deploy_lock_acquire "$commit" >"$log" 2>&1
  local rc=$?
  set -e
  return "$rc"
}

write_owner() {
  cat >"${TARANOM_DEPLOY_LOCK_FILE}.owner" <<EOF
pid=$1
started=$2
host=test-host
commit=deadbeefcafe
lib_version=2
EOF
}

flock_held() {
  if flock -n "$TARANOM_DEPLOY_LOCK_FILE" -c true 2>/dev/null; then
    return 1
  fi
  return 0
}

# --- v1 cases ---
test_dead_pid() {
  with_tmpdir _dead_pid
}
_dead_pid() {
  : >>"$TARANOM_DEPLOY_LOCK_FILE"
  write_owner 999999 $(($(date +%s) - 10))
  local log rc=0
  log="$TARANOM_DEPLOY_LOCK_FILE.acq.log"
  acquire_log "$log" testcommit || rc=$?
  assert_eq "dead PID orphan acquire" "$rc" "0"
  assert_contains "dead PID clears orphan log" "$(cat "$log")" "clearing orphan .owner"
  deploy_lock_release
  [ ! -f "${TARANOM_DEPLOY_LOCK_FILE}.owner" ] && ok "dead PID owner cleared on release" \
    || fail "dead PID owner cleared on release" "still present"
}

test_old_no_build() {
  with_tmpdir _old_no_build
}
_old_no_build() {
  # Separate bash so TERM to the holder cannot hit this test shell.
  local holder_script
  holder_script="$(mktemp)"
  cat >"$holder_script" <<EOS
#!/bin/bash
exec 9>"$TARANOM_DEPLOY_LOCK_FILE"
flock -x 9
cat >"${TARANOM_DEPLOY_LOCK_FILE}.owner" <<EOF
pid=\$\$
started=\$((\$(date +%s) - 4000))
host=t
commit=x
lib_version=2
EOF
sleep 60
EOS
  chmod +x "$holder_script"
  bash "$holder_script" &
  local holder=$!
  sleep 0.3
  local log rc=0
  log="$TARANOM_DEPLOY_LOCK_FILE.acq.log"
  acquire_log "$log" testcommit || rc=$?
  assert_eq "old no-build reclaim" "$rc" "0"
  assert_contains "old no-build reason" "$(cat "$log")" "reason=max-age-no-build-child"
  deploy_lock_release
  kill "$holder" 2>/dev/null || true
  wait "$holder" 2>/dev/null || true
  rm -f "$holder_script"
}

test_old_with_build() {
  with_tmpdir _old_with_build
}
_old_with_build() {
  local holder_script
  holder_script="$(mktemp)"
  cat >"$holder_script" <<'EOS'
#!/bin/bash
LOCK="$1"
OWNER="$2"
exec 9>"$LOCK"
flock -x 9
echo "pid=$$" >"$OWNER"
echo "started=$(($(date +%s)-4000))" >>"$OWNER"
echo "host=t" >>"$OWNER"
echo "commit=x" >>"$OWNER"
echo "lib_version=2" >>"$OWNER"
(exec -a "docker build ." sleep 60) &
sleep 60
EOS
  chmod +x "$holder_script"
  bash "$holder_script" "$TARANOM_DEPLOY_LOCK_FILE" "${TARANOM_DEPLOY_LOCK_FILE}.owner" &
  local holder=$!
  sleep 0.3
  local rc=0
  acquire_log "$TARANOM_DEPLOY_LOCK_FILE.acq.log" testcommit || rc=$?
  assert_eq "old with-build kept" "$rc" "1"
  kill "$holder" 2>/dev/null || true
  wait "$holder" 2>/dev/null || true
  rm -f "$holder_script"
}

test_fresh_healthy() {
  with_tmpdir _fresh
}
_fresh() {
  (
    exec 9>"$TARANOM_DEPLOY_LOCK_FILE"
    flock -x 9
    write_owner $BASHPID "$(date +%s)"
    sleep 30
  ) &
  local holder=$!
  sleep 0.2
  local rc=0
  acquire_log "$TARANOM_DEPLOY_LOCK_FILE.acq.log" testcommit || rc=$?
  assert_eq "fresh lock kept" "$rc" "1"
  kill "$holder" 2>/dev/null || true
  wait "$holder" 2>/dev/null || true
}

test_concurrent() {
  with_tmpdir _concurrent
}
_concurrent() {
  write_owner 999998 $(($(date +%s) - 10))
  local hold="$TARANOM_DEPLOY_LOCK_FILE.hold"
  local results="$TARANOM_DEPLOY_LOCK_FILE.results"
  local worker="$TARANOM_DEPLOY_LOCK_FILE.worker.sh"
  mkdir -p "$results"
  : >"$hold"
  cat >"$worker" <<EOF
#!/bin/bash
source "$ROOT/scripts/lib/deploy-lock.sh"
export TARANOM_DEPLOY_LOCK_FILE="$TARANOM_DEPLOY_LOCK_FILE"
export TARANOM_DEPLOY_LOCK_MAX_AGE=2700
export TARANOM_DEPLOY_LOCK_PROC_ROOT=/proc
idx="\$1"
rc=0
deploy_lock_acquire "c\${idx}" >/dev/null 2>&1 || rc=\$?
echo "\$rc" >"$results/\$idx"
if [ "\$rc" = "0" ]; then
  while [ -f "$hold" ]; do sleep 0.05; done
  deploy_lock_release
fi
EOF
  chmod +x "$worker"
  local i
  for i in $(seq 1 10); do
    bash "$worker" "$i" &
  done
  for i in $(seq 1 200); do
    [ "$(find "$results" -type f 2>/dev/null | wc -l)" -eq 10 ] && break
    sleep 0.05
  done
  local winners=0 losers=0 rc
  for i in $(seq 1 10); do
    if [ -f "$results/$i" ]; then
      rc="$(cat "$results/$i")"
      if [ "$rc" = "0" ]; then winners=$((winners + 1)); else losers=$((losers + 1)); fi
    else
      losers=$((losers + 1))
    fi
  done
  rm -f "$hold"
  wait || true
  assert_eq "concurrent one winner" "$winners" "1"
  assert_eq "concurrent nine losers" "$losers" "9"
}

test_release_owner_only() {
  with_tmpdir _rel
}
_rel() {
  deploy_lock_acquire mine >/dev/null
  bash -c "
    source '$ROOT/scripts/lib/deploy-lock.sh'
    export TARANOM_DEPLOY_LOCK_FILE='$TARANOM_DEPLOY_LOCK_FILE'
    deploy_lock_release
  "
  [ -f "${TARANOM_DEPLOY_LOCK_FILE}.owner" ] && ok "foreign release kept owner" \
    || fail "foreign release kept owner" "removed"
  deploy_lock_release
  [ ! -f "${TARANOM_DEPLOY_LOCK_FILE}.owner" ] && ok "owner release removed" \
    || fail "owner release removed" "present"
}

# --- v2 new cases ---
test_reexec_new_to_new() {
  with_tmpdir _reexec_nn
}
_reexec_nn() {
  local script marker
  marker="$TARANOM_DEPLOY_LOCK_FILE.marker"
  script="$TARANOM_DEPLOY_LOCK_FILE.reexec.sh"
  cat >"$script" <<EOF
#!/bin/bash
set -euo pipefail
export TARANOM_DEPLOY_LOCK_FILE="$TARANOM_DEPLOY_LOCK_FILE"
export TARANOM_DEPLOY_LOCK_MAX_AGE=2700
export TARANOM_DEPLOY_LOCK_PROC_ROOT=/proc
source "$ROOT/scripts/lib/deploy-lock.sh"
if [ "\${REEXECED:-0}" != "1" ]; then
  deploy_lock_acquire first >/dev/null
  deploy_lock_install_traps
  # Contender probing while we prepare reexec
  ( while [ ! -f "$marker" ]; do
      flock -n "$TARANOM_DEPLOY_LOCK_FILE" -c true && echo LEAKED >"$TARANOM_DEPLOY_LOCK_FILE.leak"
      sleep 0.05
    done ) &
  deploy_lock_prepare_reexec
  export REEXECED=1
  exec /bin/bash "$script"
fi
# After reexec: still hold lock
deploy_lock_acquire second >/dev/null
deploy_lock_install_traps
[ -f "\${TARANOM_DEPLOY_LOCK_FILE}.owner" ]
pid=\$(sed -n 's/^pid=//p' "\${TARANOM_DEPLOY_LOCK_FILE}.owner")
[ "\$pid" = "\$\$" ]
touch "$marker"
sleep 0.3
deploy_lock_release
EOF
  chmod +x "$script"
  bash "$script"
  [ ! -f "$TARANOM_DEPLOY_LOCK_FILE.leak" ] && ok "reexec new→new no flock leak" \
    || fail "reexec new→new no flock leak" "contender acquired"
  [ ! -f "${TARANOM_DEPLOY_LOCK_FILE}.owner" ] && ok "reexec new→new owner cleared" \
    || fail "reexec new→new owner cleared" "present"
}

test_reexec_new_to_old() {
  with_tmpdir _reexec_no
}
_reexec_no() {
  local script
  script="$TARANOM_DEPLOY_LOCK_FILE.reexec-old.sh"
  cat >"$script" <<EOF
#!/bin/bash
set -euo pipefail
export TARANOM_DEPLOY_LOCK_FILE="$TARANOM_DEPLOY_LOCK_FILE"
source "$ROOT/scripts/lib/deploy-lock.sh"
deploy_lock_acquire mid >/dev/null
deploy_lock_install_traps
deploy_lock_prepare_reexec
export OLD_LOCK_HOLD_SEC=1
exec /bin/bash "$ROOT/scripts/tests/fixtures/old-auto-deploy-lock.sh"
EOF
  chmod +x "$script"
  bash "$script"
  [ ! -f "${TARANOM_DEPLOY_LOCK_FILE}.owner" ] && ok "reexec new→old no owner" \
    || fail "reexec new→old no owner" "present"
  flock -n "$TARANOM_DEPLOY_LOCK_FILE" -c true && ok "reexec new→old lock free after" \
    || fail "reexec new→old lock free after" "still held"
}

test_trap_on_error() {
  with_tmpdir _trap_err
}
_trap_err() {
  bash -c '
    set -euo pipefail
    export TARANOM_DEPLOY_LOCK_FILE="'"$TARANOM_DEPLOY_LOCK_FILE"'"
    source "'"$ROOT"'/scripts/lib/deploy-lock.sh"
    deploy_lock_acquire t >/dev/null
    deploy_lock_install_traps
    false
  ' || true
  [ ! -f "${TARANOM_DEPLOY_LOCK_FILE}.owner" ] && ok "trap error clears owner" \
    || fail "trap error clears owner" "present"
  flock -n "$TARANOM_DEPLOY_LOCK_FILE" -c true && ok "trap error frees lock" \
    || fail "trap error frees lock" "held"
}

test_trap_signals() {
  with_tmpdir _trap_sig
}
_trap_sig() {
  local sig code
  for sig in TERM INT HUP; do
    case "$sig" in
      TERM) code=143 ;;
      INT) code=130 ;;
      HUP) code=129 ;;
    esac
    (
      export TARANOM_DEPLOY_LOCK_FILE="$TARANOM_DEPLOY_LOCK_FILE"
      source "$ROOT/scripts/lib/deploy-lock.sh"
      deploy_lock_acquire "sig$sig" >/dev/null
      deploy_lock_install_traps
      sleep 30
    ) &
    local spid=$!
    sleep 0.2
    kill -s "$sig" "$spid" 2>/dev/null || true
    wait "$spid" 2>/dev/null || true
    local ec=$?
    # bash may report 128+N via wait
    if [ ! -f "${TARANOM_DEPLOY_LOCK_FILE}.owner" ]; then
      ok "trap $sig clears owner"
    else
      fail "trap $sig clears owner" "present"
    fi
    if flock -n "$TARANOM_DEPLOY_LOCK_FILE" -c true; then
      ok "trap $sig frees lock"
    else
      fail "trap $sig frees lock" "held"
    fi
  done
}

test_mixed_holders() {
  with_tmpdir _mixed
}
_mixed() {
  OLD_LOCK_HOLD_SEC=8 bash "$ROOT/scripts/tests/fixtures/old-auto-deploy-lock.sh" &
  local oldpid=$!
  local i
  for i in $(seq 1 50); do
    if ! flock -n "$TARANOM_DEPLOY_LOCK_FILE" -c true 2>/dev/null; then
      break
    fi
    sleep 0.05
  done
  local rc=0
  acquire_log "$TARANOM_DEPLOY_LOCK_FILE.acq.log" newbie || rc=$?
  assert_eq "new skips while old holds" "$rc" "1"
  [ ! -f "${TARANOM_DEPLOY_LOCK_FILE}.owner" ] && ok "new did not write owner over old" \
    || fail "new did not write owner over old" "owner created"
  wait "$oldpid" 2>/dev/null || true

  # New holds → old skips
  deploy_lock_acquire mine >/dev/null
  local out
  out="$(TARANOM_DEPLOY_LOCK_FILE="$TARANOM_DEPLOY_LOCK_FILE" OLD_LOCK_HOLD_SEC=1 \
    bash "$ROOT/scripts/tests/fixtures/old-auto-deploy-lock.sh")"
  assert_contains "old skips while new holds" "$out" "another deploy is running"
  deploy_lock_release
}

test_rollback_orphan_owner() {
  with_tmpdir _rollback
}
_rollback() {
  write_owner 999997 $(($(date +%s) - 100))
  # Old script should run fine (ignores .owner)
  OLD_LOCK_HOLD_SEC=1 bash "$ROOT/scripts/tests/fixtures/old-auto-deploy-lock.sh"
  flock -n "$TARANOM_DEPLOY_LOCK_FILE" -c true
  local log rc=0
  log="$TARANOM_DEPLOY_LOCK_FILE.acq.log"
  acquire_log "$log" after || rc=$?
  assert_eq "new acquires after old with orphan owner" "$rc" "0"
  assert_contains "new clears orphan owner" "$(cat "$log")" "clearing orphan .owner"
  deploy_lock_release
}

test_no_fd_leak() {
  with_tmpdir _fdleak
}
_fdleak() {
  deploy_lock_acquire leaktest >/dev/null
  deploy_lock_install_traps
  local child
  child="$(run_nolock bash -c 'ls -l /proc/$$/fd/9 2>&1 || echo NOFD9')"
  assert_contains "run_nolock child has no fd 9" "$child" "NOFD9"
  deploy_lock_release
}

test_preflight_approval() {
  with_tmpdir _pref
}
_pref() {
  local dir gate sha
  dir="$(dirname "$TARANOM_DEPLOY_LOCK_FILE")"
  gate="$ROOT/scripts/lib/deploy-gate.py"
  export GATE_PY="$gate"
  sha="$(printf 'a%.0s' {1..40} | tr 'a' 'a')"
  # 40 hex chars
  sha="$(python3 -c 'print("a"*40)')"

  local f="$dir/approval.json"
  # missing
  validate_approval_file "$dir/nope.json" "$sha" >/dev/null 2>&1 && fail "pref missing" "accepted" || ok "pref missing rejected"
  # empty
  : >"$f"
  validate_approval_file "$f" "$sha" >/dev/null 2>&1 && fail "pref empty" "accepted" || ok "pref empty rejected"
  # bad json
  echo '{' >"$f"
  validate_approval_file "$f" "$sha" >/dev/null 2>&1 && fail "pref bad json" "accepted" || ok "pref bad json rejected"
  # no commit
  echo '{"goRef":"GO x"}' >"$f"
  local before after
  before="$(cksum "$f")"
  validate_approval_file "$f" "$sha" >/dev/null 2>&1 && fail "pref no commit" "accepted" || ok "pref no commit rejected"
  after="$(cksum "$f")"
  assert_eq "pref checksum unchanged (no commit)" "$before" "$after"
  # mismatch
  echo "{\"commit\":\"$(python3 -c 'print(\"b\"*40)')\",\"goRef\":\"GO x\"}" >"$f"
  before="$(cksum "$f")"
  validate_approval_file "$f" "$sha" >/dev/null 2>&1 && fail "pref mismatch" "accepted" || ok "pref mismatch rejected"
  after="$(cksum "$f")"
  assert_eq "pref checksum unchanged (mismatch)" "$before" "$after"
  # no goRef
  echo "{\"commit\":\"$sha\"}" >"$f"
  validate_approval_file "$f" "$sha" >/dev/null 2>&1 && fail "pref no goRef" "accepted" || ok "pref no goRef rejected"
  # valid
  echo "{\"commit\":\"$sha\",\"goRef\":\"GO test\"}" >"$f"
  before="$(cksum "$f")"
  validate_approval_file "$f" "$sha" >/dev/null && ok "pref valid accepted" || fail "pref valid accepted" "rejected"
  after="$(cksum "$f")"
  assert_eq "pref checksum unchanged (valid)" "$before" "$after"
}

test_created_check() {
  with_tmpdir _created
}
_created() {
  local bindir
  bindir="$(dirname "$TARANOM_DEPLOY_LOCK_FILE")/bin"
  mkdir -p "$bindir"
  cat >"$bindir/docker" <<'EOF'
#!/bin/bash
if [ "$1" = "compose" ] && [ "$2" = "ps" ]; then
  echo "taranom_api"
  echo "taranom_web"
  exit 0
fi
exit 0
EOF
  chmod +x "$bindir/docker"
  local out
  out="$(PATH="$bindir:$PATH" bash -c 'source "'"$ROOT"'/scripts/lib/compose-created-check.sh"; list_created_containers')"
  assert_contains "created-check lists names" "$out" "taranom_api"
}

echo "1..40"
test_dead_pid
test_old_no_build
test_old_with_build
test_fresh_healthy
test_concurrent
test_release_owner_only
test_reexec_new_to_new
test_reexec_new_to_old
test_trap_on_error
test_trap_signals
test_mixed_holders
test_rollback_orphan_owner
test_no_fd_leak
test_preflight_approval
test_created_check

echo "# passed=$PASS failed=$FAIL"
if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
exit 0

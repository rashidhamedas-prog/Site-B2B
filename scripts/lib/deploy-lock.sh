#!/bin/bash
# ============================================================================
# Deploy lock with stale-lock detection (owner metadata + age / dead-pid).
# Source from auto-deploy.sh. Requires bash, flock, coreutils, and /proc (or a
# fake tree via TARANOM_DEPLOY_LOCK_PROC_ROOT for tests).
#
# Env:
#   TARANOM_DEPLOY_LOCK_FILE      default /tmp/taranom-autodeploy.lock
#   TARANOM_DEPLOY_LOCK_MAX_AGE   seconds, default 2700 (45m)
#   TARANOM_DEPLOY_LOCK_PROC_ROOT default /proc
# ============================================================================

: "${TARANOM_DEPLOY_LOCK_FILE:=/tmp/taranom-autodeploy.lock}"
: "${TARANOM_DEPLOY_LOCK_MAX_AGE:=2700}"
: "${TARANOM_DEPLOY_LOCK_PROC_ROOT:=/proc}"

DEPLOY_LOCK_STALE_REASON=""

_deploy_lock_owner_file() {
  printf '%s\n' "${TARANOM_DEPLOY_LOCK_FILE}.owner"
}

_deploy_lock_guard_file() {
  printf '%s\n' "${TARANOM_DEPLOY_LOCK_FILE}.guard"
}

_deploy_lock_read_owner() {
  # Sets _ol_pid _ol_started _ol_host _ol_commit from owner file; returns 1 if missing/invalid.
  local owner line
  owner="$(_deploy_lock_owner_file)"
  _ol_pid=""
  _ol_started=""
  _ol_host=""
  _ol_commit=""
  [ -f "$owner" ] || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      pid=*) _ol_pid="${line#pid=}" ;;
      started=*) _ol_started="${line#started=}" ;;
      host=*) _ol_host="${line#host=}" ;;
      commit=*) _ol_commit="${line#commit=}" ;;
    esac
  done <"$owner"
  [ -n "$_ol_pid" ] && [ -n "$_ol_started" ] || return 1
  return 0
}

_deploy_lock_write_owner_for() {
  local for_pid="$1"
  local commit="$2"
  local owner tmp dir
  owner="$(_deploy_lock_owner_file)"
  dir="$(dirname -- "$owner")"
  tmp="$(mktemp "${dir}/.deploy-lock-owner.XXXXXX")"
  {
    printf 'pid=%s\n' "$for_pid"
    printf 'started=%s\n' "$(date +%s)"
    printf 'host=%s\n' "$(hostname 2>/dev/null || echo unknown)"
    printf 'commit=%s\n' "${commit}"
  } >"$tmp"
  mv -f "$tmp" "$owner"
}

_deploy_lock_pid_alive() {
  local pid="$1"
  local proc_root="${TARANOM_DEPLOY_LOCK_PROC_ROOT}"
  if [ -d "${proc_root}/${pid}" ]; then
    return 0
  fi
  if [ "$proc_root" = "/proc" ] && kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  return 1
}

_deploy_lock_read_cmdline() {
  local pid="$1"
  local cmdfile="${TARANOM_DEPLOY_LOCK_PROC_ROOT}/${pid}/cmdline"
  if [ ! -r "$cmdfile" ]; then
    printf '\n'
    return 0
  fi
  tr '\0' ' ' <"$cmdfile" 2>/dev/null || true
}

_deploy_lock_cmdline_is_build() {
  local cmd="$1"
  case "$cmd" in
    *"docker build"*|*"docker compose"*|*"docker-compose"*|*"buildx"*) return 0 ;;
  esac
  return 1
}

_deploy_lock_has_build_descendant() {
  # BFS over children of $1 using /proc/*/stat ppid field.
  local root_pid="$1"
  local proc_root="${TARANOM_DEPLOY_LOCK_PROC_ROOT}"
  local -a queue=("$root_pid")
  local -A seen=()
  local cur child ppid statfile cmd
  seen["$root_pid"]=1

  while [ "${#queue[@]}" -gt 0 ]; do
    cur="${queue[0]}"
    queue=("${queue[@]:1}")

    for statfile in "${proc_root}"/[0-9]*/stat; do
      [ -f "$statfile" ] || continue
      child="${statfile%/stat}"
      child="${child##*/}"
      # Format: pid (comm) state ppid ... — comm may contain spaces/parens.
      ppid="$(sed -n 's/.*) [A-Za-z] \([0-9][0-9]*\).*/\1/p' "$statfile" 2>/dev/null || true)"
      [ -n "$ppid" ] || continue
      [ "$ppid" = "$cur" ] || continue
      if [ -n "${seen[$child]+x}" ]; then
        continue
      fi
      seen["$child"]=1
      cmd="$(_deploy_lock_read_cmdline "$child")"
      if _deploy_lock_cmdline_is_build "$cmd"; then
        return 0
      fi
      queue+=("$child")
    done
  done
  return 1
}

deploy_lock_is_stale() {
  # Returns 0 if stale (sets DEPLOY_LOCK_STALE_REASON), 1 if healthy / self.
  # Optional arg: caller pid to treat as self (defaults to $BASHPID).
  # NOTE: use BASHPID not $$ — $$ is the parent shell even inside ( ) subshells.
  local self_pid="${1:-$BASHPID}"
  DEPLOY_LOCK_STALE_REASON=""
  local now age
  if ! _deploy_lock_read_owner; then
    return 1
  fi
  # Re-exec of same process: treat as own lock (not stale).
  if [ "$_ol_pid" = "$self_pid" ]; then
    return 1
  fi
  if ! _deploy_lock_pid_alive "$_ol_pid"; then
    DEPLOY_LOCK_STALE_REASON="dead-pid"
    return 0
  fi
  now="$(date +%s)"
  age=$((now - _ol_started))
  if [ "$age" -gt "$TARANOM_DEPLOY_LOCK_MAX_AGE" ]; then
    if ! _deploy_lock_has_build_descendant "$_ol_pid"; then
      DEPLOY_LOCK_STALE_REASON="max-age-no-build-child"
      return 0
    fi
  fi
  return 1
}

_deploy_lock_log_stale_release() {
  local reason="$1"
  local old_pid="$2"
  local old_started="$3"
  local old_host="$4"
  local old_commit="$5"
  local now age c12
  now="$(date +%s)"
  age=$((now - old_started))
  c12="${old_commit:0:12}"
  printf '%s deploy-lock: releasing stale lock reason=%s old_pid=%s age=%ss old_host=%s old_commit=%s\n' \
    "$(date -Is)" "$reason" "$old_pid" "$age" "$old_host" "$c12"
}

_deploy_lock_ensure_paths() {
  local guard
  guard="$(_deploy_lock_guard_file)"
  : >>"$TARANOM_DEPLOY_LOCK_FILE" 2>/dev/null || true
  : >>"$guard" 2>/dev/null || true
}

deploy_lock_acquire() {
  # Critical section runs in a flock subshell. Owner pid is the caller's
  # BASHPID (not $$ — $$ stays the parent even in subshells). After auto-deploy
  # re-exec, BASHPID is unchanged so the lock is refreshed as self. Guard is
  # released when the flock subshell exits — before any docker/build work.
  local commit="${1:-unknown}"
  local mypid=$BASHPID
  local owner guard statusfile status
  owner="$(_deploy_lock_owner_file)"
  guard="$(_deploy_lock_guard_file)"
  _deploy_lock_ensure_paths
  statusfile="$(mktemp)"

  (
    flock -x 9 || exit 98
    if _deploy_lock_read_owner; then
      if [ "$_ol_pid" = "$mypid" ]; then
        _deploy_lock_write_owner_for "$mypid" "$commit"
        echo 0 >"$statusfile"
        exit 0
      fi
      if deploy_lock_is_stale "$mypid"; then
        _deploy_lock_log_stale_release \
          "$DEPLOY_LOCK_STALE_REASON" "$_ol_pid" "$_ol_started" "${_ol_host:-unknown}" "${_ol_commit:-unknown}"
        rm -f "$owner"
      else
        echo 1 >"$statusfile"
        exit 0
      fi
    fi
    _deploy_lock_write_owner_for "$mypid" "$commit"
    echo 0 >"$statusfile"
  ) 9>"$guard"

  status="$(cat "$statusfile" 2>/dev/null || echo 1)"
  rm -f "$statusfile"
  return "$status"
}

deploy_lock_release() {
  local mypid=$BASHPID
  local owner guard
  owner="$(_deploy_lock_owner_file)"
  guard="$(_deploy_lock_guard_file)"
  _deploy_lock_ensure_paths
  (
    flock -x 9 || exit 98
    if _deploy_lock_read_owner && [ "$_ol_pid" = "$mypid" ]; then
      rm -f "$owner"
    fi
  ) 9>"$guard"
}

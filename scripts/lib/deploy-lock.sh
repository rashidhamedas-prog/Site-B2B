#!/bin/bash
# ============================================================================
# Deploy lock v2 — flock on fd 9 is the sole source of truth.
# .owner is advisory metadata written only after flock is held.
#
# Env:
#   TARANOM_DEPLOY_LOCK_FILE      default /tmp/taranom-autodeploy.lock
#   TARANOM_DEPLOY_LOCK_MAX_AGE   seconds, default 2700
#   TARANOM_DEPLOY_LOCK_PROC_ROOT default /proc (overridable in tests)
#   TARANOM_DEPLOY_LOCK_HELD_BY   set across re-exec (caller pid)
# ============================================================================

LOCK_LIB_VERSION=2

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

# Run a command with lock fd 9 closed so children cannot inherit the flock.
run_nolock() {
  "$@" 9>&-
}

_deploy_lock_read_owner() {
  local owner line
  owner="$(_deploy_lock_owner_file)"
  _ol_pid=""
  _ol_started=""
  _ol_host=""
  _ol_commit=""
  _ol_lib_version=""
  [ -f "$owner" ] || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      pid=*) _ol_pid="${line#pid=}" ;;
      started=*) _ol_started="${line#started=}" ;;
      host=*) _ol_host="${line#host=}" ;;
      commit=*) _ol_commit="${line#commit=}" ;;
      lib_version=*) _ol_lib_version="${line#lib_version=}" ;;
    esac
  done <"$owner"
  [ -n "$_ol_pid" ] && [ -n "$_ol_started" ] || return 1
  return 0
}

_deploy_lock_write_owner() {
  local commit="$1"
  local owner tmp dir
  owner="$(_deploy_lock_owner_file)"
  dir="$(dirname -- "$owner")"
  tmp="$(mktemp "${dir}/.deploy-lock-owner.XXXXXX")"
  {
    # BASHPID: $$ is the parent even inside $(...) / subshells.
    printf 'pid=%s\n' "$BASHPID"
    printf 'started=%s\n' "$(date +%s)"
    printf 'host=%s\n' "$(hostname 2>/dev/null || echo unknown)"
    printf 'commit=%s\n' "${commit}"
    printf 'lib_version=%s\n' "${LOCK_LIB_VERSION}"
  } >"$tmp"
  mv -f "$tmp" "$owner"
}

_deploy_lock_clear_owner() {
  rm -f "$(_deploy_lock_owner_file)"
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

_deploy_lock_fd9_points_to_lock() {
  local proc_root="${TARANOM_DEPLOY_LOCK_PROC_ROOT}"
  local link target
  link="${proc_root}/${BASHPID}/fd/9"
  [ -e "$link" ] || [ -L "$link" ] || return 1
  target="$(readlink "$link" 2>/dev/null || true)"
  case "$target" in
    "${TARANOM_DEPLOY_LOCK_FILE}"|"${TARANOM_DEPLOY_LOCK_FILE} (deleted)") return 0 ;;
  esac
  # Fallback: resolve both paths
  local lock_real fd_real
  lock_real="$(readlink -f "$TARANOM_DEPLOY_LOCK_FILE" 2>/dev/null || true)"
  fd_real="$(readlink -f "$link" 2>/dev/null || true)"
  [ -n "$lock_real" ] && [ "$lock_real" = "$fd_real" ]
}

_deploy_lock_list_holders() {
  # PIDs with an open fd pointing at LOCK_FILE.
  # Pass the caller's BASHPID as $1 — required because process-substitution
  # subshells have a different BASHPID than the shell that opened fd 9.
  local self="${1:-$BASHPID}"
  local proc_root="${TARANOM_DEPLOY_LOCK_PROC_ROOT}"
  local link target pid
  # Inspect fd/9 first (our convention); then a shallow scan of other fds.
  for link in "${proc_root}"/[0-9]*/fd/9; do
    [ -e "$link" ] || [ -L "$link" ] || continue
    target="$(readlink "$link" 2>/dev/null || true)"
    case "$target" in
      "${TARANOM_DEPLOY_LOCK_FILE}"|"${TARANOM_DEPLOY_LOCK_FILE} (deleted)") ;;
      *) continue ;;
    esac
    pid="$(printf '%s\n' "$link" | sed -n 's|.*/\([0-9][0-9]*\)/fd/.*|\1|p')"
    [ -n "$pid" ] || continue
    [ "$pid" = "$self" ] && continue
    [ "$pid" = "$$" ] && continue
    printf '%s\n' "$pid"
  done | sort -u
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

_deploy_lock_cmdline_is_autodeploy() {
  local cmd="$1"
  case "$cmd" in
    *auto-deploy.sh*) return 0 ;;
  esac
  return 1
}

_deploy_lock_has_build_activity() {
  local self=$BASHPID
  local pid child ppid statfile cmd
  local -a queue=()
  local -A seen=()
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    queue+=("$pid")
    seen["$pid"]=1
  done < <(_deploy_lock_list_holders "$self")

  # Also consider .owner pid as a root for descendant walk when present.
  if _deploy_lock_read_owner && [ -n "$_ol_pid" ] && [ -z "${seen[$_ol_pid]+x}" ]; then
    queue+=("$_ol_pid")
    seen["$_ol_pid"]=1
  fi

  local proc_root="${TARANOM_DEPLOY_LOCK_PROC_ROOT}"
  while [ "${#queue[@]}" -gt 0 ]; do
    pid="${queue[0]}"
    queue=("${queue[@]:1}")
    cmd="$(_deploy_lock_read_cmdline "$pid")"
    if _deploy_lock_cmdline_is_build "$cmd"; then
      return 0
    fi
    # Prefer pgrep -P (O(children)); fall back to /proc walk when unavailable
    # (e.g. fake TARANOM_DEPLOY_LOCK_PROC_ROOT in unit tests).
    if [ "$proc_root" = "/proc" ] && command -v pgrep >/dev/null 2>&1; then
      while IFS= read -r child; do
        [ -n "$child" ] || continue
        if [ -n "${seen[$child]+x}" ]; then
          continue
        fi
        seen["$child"]=1
        queue+=("$child")
      done < <(pgrep -P "$pid" 2>/dev/null || true)
    else
      for statfile in "${proc_root}"/[0-9]*/stat; do
        [ -f "$statfile" ] || continue
        child="${statfile%/stat}"
        child="${child##*/}"
        ppid="$(sed -n 's/.*) [A-Za-z] \([0-9][0-9]*\).*/\1/p' "$statfile" 2>/dev/null || true)"
        [ "$ppid" = "$pid" ] || continue
        if [ -n "${seen[$child]+x}" ]; then
          continue
        fi
        seen["$child"]=1
        queue+=("$child")
      done
    fi
  done
  return 1
}

_deploy_lock_has_live_autodeploy_holder() {
  local self=$BASHPID
  local pid cmd
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    _deploy_lock_pid_alive "$pid" || continue
    cmd="$(_deploy_lock_read_cmdline "$pid")"
    if _deploy_lock_cmdline_is_autodeploy "$cmd"; then
      return 0
    fi
  done < <(_deploy_lock_list_holders "$self")
  return 1
}

_deploy_lock_has_any_live_holder() {
  # Any live process holding fd 9 on the lock (besides self) means the lock
  # is in active use — never reclaim in that case (avoids racing a peer that
  # has flock but has not yet written .owner).
  local self=$BASHPID
  local pid
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    if _deploy_lock_pid_alive "$pid"; then
      return 0
    fi
  done < <(_deploy_lock_list_holders "$self")
  return 1
}

deploy_lock_is_stale() {
  DEPLOY_LOCK_STALE_REASON=""
  local now age

  if _deploy_lock_read_owner; then
    if [ "$_ol_pid" = "$BASHPID" ]; then
      return 1
    fi
    if ! _deploy_lock_pid_alive "$_ol_pid"; then
      # Owner metadata is stale; only reclaim if nobody live still holds flock.
      if _deploy_lock_has_any_live_holder; then
        return 1
      fi
      DEPLOY_LOCK_STALE_REASON="dead-pid"
      return 0
    fi
    now="$(date +%s)"
    age=$((now - _ol_started))
    if [ "$age" -gt "$TARANOM_DEPLOY_LOCK_MAX_AGE" ]; then
      if ! _deploy_lock_has_build_activity; then
        DEPLOY_LOCK_STALE_REASON="max-age-no-build-child"
        return 0
      fi
    fi
    return 1
  fi

  # No .owner (legacy flock holder or peer mid-acquire).
  # Never reclaim while any live process holds the flock.
  if _deploy_lock_has_any_live_holder; then
    return 1
  fi
  # No live holders + no owner → free for the taking (caller still needs flock).
  return 1
}

_deploy_lock_log_stale() {
  local reason="$1"
  local old_pid="${2:-unknown}"
  local old_started="${3:-0}"
  local self=$BASHPID
  local holders now age
  holders="$(_deploy_lock_list_holders "$self" | tr '\n' ',' | sed 's/,$//')"
  now="$(date +%s)"
  if [ "${old_started}" -gt 0 ] 2>/dev/null; then
    age=$((now - old_started))
  else
    age=0
  fi
  printf '%s deploy-lock: stale reason=%s old_pid=%s age=%ss holders=%s\n' \
    "$(date -Is)" "$reason" "$old_pid" "$age" "${holders:-none}"
}

_deploy_lock_term_orphan_holders() {
  local self=$BASHPID
  local pid cmd
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    [ "$pid" = "$self" ] && continue
    [ "$pid" = "$$" ] && continue
    cmd="$(_deploy_lock_read_cmdline "$pid")"
    if _deploy_lock_cmdline_is_autodeploy "$cmd"; then
      continue
    fi
    # Never signal our own process group leader by accident.
    kill -TERM "$pid" 2>/dev/null || true
  done < <(_deploy_lock_list_holders "$self")
}

_deploy_lock_ensure_paths() {
  : >>"$TARANOM_DEPLOY_LOCK_FILE" 2>/dev/null || true
  : >>"$(_deploy_lock_guard_file)" 2>/dev/null || true
}

_deploy_lock_claim_after_flock() {
  local commit="$1"
  if _deploy_lock_read_owner && [ "$_ol_pid" != "$BASHPID" ]; then
    printf '%s deploy-lock: clearing orphan .owner old_pid=%s\n' \
      "$(date -Is)" "${_ol_pid:-unknown}"
    _deploy_lock_clear_owner
  fi
  _deploy_lock_write_owner "$commit"
}

deploy_lock_acquire() {
  # 0 = acquired, 1 = healthy lock held by another (caller should skip).
  local commit="${1:-unknown}"
  local guard
  _deploy_lock_ensure_paths
  guard="$(_deploy_lock_guard_file)"

  # Re-exec: same PID still holds fd 9 — do not reopen (would drop flock).
  if [ "${TARANOM_DEPLOY_LOCK_HELD_BY:-}" = "$BASHPID" ] && _deploy_lock_fd9_points_to_lock; then
    flock -n 9 || true
    _deploy_lock_write_owner "$commit"
    return 0
  fi

  exec 9>"$TARANOM_DEPLOY_LOCK_FILE"

  if flock -n 9; then
    _deploy_lock_claim_after_flock "$commit"
    return 0
  fi

  # Busy — serialize stale takeover under .guard (fd 8), act on our fd 9.
  exec 8>"$guard"
  flock -x 8

  if flock -n 9; then
    exec 8>&-
    _deploy_lock_claim_after_flock "$commit"
    return 0
  fi

  if deploy_lock_is_stale; then
    _deploy_lock_log_stale \
      "$DEPLOY_LOCK_STALE_REASON" "${_ol_pid:-unknown}" "${_ol_started:-0}"
    _deploy_lock_term_orphan_holders
    if flock -w 10 9; then
      exec 8>&-
      _deploy_lock_claim_after_flock "$commit"
      return 0
    fi
  fi

  exec 8>&-
  return 1
}

deploy_lock_prepare_reexec() {
  # Drop advisory owner + traps before exec into possibly-older script image.
  # Keep fd 9 + flock open; mark for the next image.
  _deploy_lock_clear_owner
  trap - EXIT INT TERM HUP
  export TARANOM_DEPLOY_LOCK_HELD_BY=$BASHPID
}

deploy_lock_release() {
  if _deploy_lock_read_owner && [ "$_ol_pid" = "$BASHPID" ]; then
    _deploy_lock_clear_owner
  fi
  if { true >&9; } 2>/dev/null; then
    flock -u 9 2>/dev/null || true
    exec 9>&- 2>/dev/null || true
  fi
  unset TARANOM_DEPLOY_LOCK_HELD_BY || true
}

deploy_lock_install_traps() {
  trap 'deploy_lock_release' EXIT
  trap 'deploy_lock_release; exit 130' INT
  trap 'deploy_lock_release; exit 143' TERM
  trap 'deploy_lock_release; exit 129' HUP
}

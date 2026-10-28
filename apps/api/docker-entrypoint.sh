#!/bin/sh
# Drop privileges after fixing shared omnichannel IPC volume ownership.
# Named volume mounts as root on first create; worker (taranom) must write heartbeat/drain.
set -eu

if [ "$(id -u)" = "0" ]; then
  # API mounts /ipc:ro — skip chown there (not writable). Worker mounts rw.
  if [ -d /ipc ] && [ -w /ipc ]; then
    chown -R taranom:taranom /ipc
    chmod 775 /ipc
  fi
  exec su-exec taranom "$@"
fi

exec "$@"

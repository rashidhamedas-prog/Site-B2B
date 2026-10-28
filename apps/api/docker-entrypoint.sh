#!/bin/sh
# Drop privileges after fixing shared omnichannel IPC volume ownership.
# Named volume mounts as root on first create; worker (taranom) must write heartbeat/drain.
set -eu

if [ "$(id -u)" = "0" ]; then
  # API mounts /ipc:ro. Root still sees -w as true on many kernels ? probe with touch.
  if [ -d /ipc ]; then
    if touch /ipc/.ipc-write-probe 2>/dev/null; then
      rm -f /ipc/.ipc-write-probe
      chown -R taranom:taranom /ipc
      chmod 775 /ipc
    fi
  fi
  exec su-exec taranom "$@"
fi

exec "$@"

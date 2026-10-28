#!/bin/bash
# ============================================================================
# List docker compose containers stuck in Created status.
# ============================================================================

list_created_containers() {
  # Prints container names (one per line). Non-empty means stuck.
  # Uses `docker` from PATH (tests may inject a fake).
  docker compose ps -a --status created --format '{{.Name}}' 2>/dev/null || true
}

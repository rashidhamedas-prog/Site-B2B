#!/usr/bin/env bash
set -euo pipefail

repo=/opt/taranom/backups/20260801-hardening/history-rewrite.git
remote_url="$(git -C /opt/taranom remote get-url origin)"

cd "$repo"
git remote remove origin 2>/dev/null || true
git remote add origin "$remote_url"
git push origin --force --all
git push origin --force --tags
echo "HISTORY_FORCE_PUSH_OK"

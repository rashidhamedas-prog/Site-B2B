#!/usr/bin/env bash
set -euo pipefail

base=/opt/taranom/backups/20260801-hardening
tools_dir="$base/tools/gitleaks"
repo="$base/history-rewrite.git"
mkdir -p "$tools_dir"
chmod 700 "$base/tools" "$tools_dir"

release_json="$tools_dir/release.json"
curl -fsSL https://api.github.com/repos/gitleaks/gitleaks/releases/latest -o "$release_json"
tag="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["tag_name"])' "$release_json")"
version="${tag#v}"
archive="gitleaks_${version}_linux_x64.tar.gz"
checksums="gitleaks_${version}_checksums.txt"
release_url="https://github.com/gitleaks/gitleaks/releases/download/${tag}"

curl -fsSL "$release_url/$archive" -o "$tools_dir/$archive"
curl -fsSL "$release_url/$checksums" -o "$tools_dir/$checksums"
(
  cd "$tools_dir"
  grep "  ${archive}$" "$checksums" | sha256sum -c -
  tar -xzf "$archive" gitleaks
  chmod 700 gitleaks
)

cd "$repo"
printf 'SERVER_INFO_HISTORY_COUNT='
git log --all --format=%H -- TARANOM-SERVER-INFO.txt | wc -l
printf 'CLAUDE_MEMORY_HISTORY_COUNT='
git log --all --format=%H -- .claude/memory.json | wc -l

"$tools_dir/gitleaks" git . --no-banner --redact --exit-code=0 \
  --report-format=json --report-path="$base/gitleaks-rewritten.json" >/dev/null
chmod 600 "$base/gitleaks-rewritten.json"
python3 -c 'import json,sys; print("GITLEAKS_FINDINGS=" + str(len(json.load(open(sys.argv[1])))))' \
  "$base/gitleaks-rewritten.json"

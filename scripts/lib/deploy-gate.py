#!/usr/bin/env python3
"""Deploy approval gate for scripts/auto-deploy.sh (host has python3, not node).

FORCE / TARANOM_DEPLOY_FORCE must never bypass approval.
Logic mirrors scripts/lib/deploy-gate.mjs — keep them in sync.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


class GateError(Exception):
    def __init__(self, message: str, code: str) -> None:
        super().__init__(message)
        self.code = code


def read_approval(file_path: str) -> dict:
    path = Path(file_path)
    if not file_path or not path.is_file():
        raise GateError(f"deploy approval missing: {file_path or '(empty path)'}", "APPROVAL_MISSING")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise GateError(f"deploy approval unreadable: {file_path}", "APPROVAL_INVALID") from exc
    if not isinstance(raw, dict):
        raise GateError("deploy approval must be a JSON object", "APPROVAL_INVALID")
    return raw


def assert_approval(approval: dict, commit: str, force: str | bool = False) -> dict:
    target = (commit or "").strip().lower()
    if len(target) != 40 or any(c not in "0123456789abcdef" for c in target):
        raise GateError(
            f"deploy target commit must be a full 40-char sha, got: {commit or '(empty)'}",
            "COMMIT_INVALID",
        )

    approved = str(approval.get("commit") or "").strip().lower()
    if not approved:
        raise GateError("deploy approval.commit is required", "APPROVAL_INVALID")

    force_on = str(force).lower() not in ("", "0", "false", "no")
    if approved != target:
        suffix = " (FORCE does not bypass)" if force_on else ""
        raise GateError(
            f"deploy approval commit mismatch: approval={approved[:12]} target={target[:12]}{suffix}",
            "APPROVAL_COMMIT_MISMATCH",
        )

    go_ref = str(approval.get("goRef") or "").strip()
    if not go_ref:
        raise GateError(
            "deploy approval.goRef is required (written GO from Hamed)",
            "APPROVAL_INVALID",
        )
    return {"commit": target, "goRef": go_ref}


def check_approval_file(file_path: str, commit: str, force: str | bool = False) -> dict:
    return assert_approval(read_approval(file_path), commit, force)


def format_deploy_log(commit: str, go_ref: str, at: datetime | None = None) -> str:
    when = at or datetime.now(timezone.utc)
    return f"{when.isoformat().replace('+00:00', 'Z')}\tcommit={commit}\tgoRef={go_ref}"


def consume_approval(file_path: str, log_path: str, commit: str, go_ref: str) -> str:
    line = format_deploy_log(commit, go_ref)
    log = Path(log_path)
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")
    path = Path(file_path)
    if path.is_file():
        path.unlink()
    return line


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="deploy-gate.py")
    sub = parser.add_subparsers(dest="cmd", required=True)

    assert_p = sub.add_parser("assert-approval")
    assert_p.add_argument("--file", required=True)
    assert_p.add_argument("--commit", required=True)
    assert_p.add_argument("--force", default=os.environ.get("TARANOM_DEPLOY_FORCE", ""))

    consume_p = sub.add_parser("consume-approval")
    consume_p.add_argument("--file", required=True)
    consume_p.add_argument("--log", required=True)
    consume_p.add_argument("--commit", required=True)
    consume_p.add_argument("--go-ref", required=True)

    args = parser.parse_args(argv)
    try:
        if args.cmd == "assert-approval":
            result = check_approval_file(args.file, args.commit, args.force)
            sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
            return 0
        if args.cmd == "consume-approval":
            line = consume_approval(args.file, args.log, args.commit, args.go_ref)
            sys.stdout.write(line + "\n")
            return 0
    except GateError as exc:
        sys.stderr.write(str(exc) + "\n")
        return 1
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

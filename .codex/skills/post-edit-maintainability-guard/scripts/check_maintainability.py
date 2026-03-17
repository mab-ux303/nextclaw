#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Iterable

ROOT = Path(__file__).resolve().parents[4]
CODE_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
    ".py",
    ".sh",
}
IGNORED_PARTS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    ".vite",
    ".vitepress",
    "out",
    "tmp",
}


@dataclass(frozen=True)
class Budget:
    max_lines: int
    category: str


@dataclass(frozen=True)
class Finding:
    level: str
    path: str
    category: str
    budget: int
    current_lines: int
    previous_lines: int | None
    delta_lines: int | None
    message: str
    suggested_seam: str


def run_git(*args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if check and result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git command failed")
    return result.stdout


def is_code_path(path_text: str) -> bool:
    path = PurePosixPath(path_text)
    if any(part in IGNORED_PARTS for part in path.parts):
        return False
    return path.suffix.lower() in CODE_EXTENSIONS


def normalize_path(path_text: str) -> str:
    raw = path_text.strip()
    if not raw:
        return raw
    return PurePosixPath(raw).as_posix()


def list_changed_paths() -> list[str]:
    output = run_git("status", "--porcelain")
    paths: list[str] = []
    for line in output.splitlines():
        if not line:
            continue
        payload = line[3:]
        if " -> " in payload:
            payload = payload.split(" -> ", 1)[1]
        path_text = normalize_path(payload)
        if path_text and is_code_path(path_text):
            paths.append(path_text)
    seen: set[str] = set()
    unique_paths: list[str] = []
    for path_text in paths:
        if path_text in seen:
            continue
        seen.add(path_text)
        unique_paths.append(path_text)
    return unique_paths


def count_lines(path_text: str) -> int:
    path = ROOT / path_text
    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        return sum(1 for _ in handle)


def get_head_lines(path_text: str) -> int | None:
    result = subprocess.run(
        ["git", "show", f"HEAD:{path_text}"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    return len(result.stdout.splitlines())


def choose_budget(path_text: str) -> Budget:
    path = PurePosixPath(path_text)
    name = path.name.lower()
    segments = [segment.lower() for segment in path.parts]
    stem = path.stem.lower()

    if any(token in name for token in (".test.", ".spec.")) or any(segment in {"__tests__", "tests"} for segment in segments):
        return Budget(900, "test")

    if stem in {"types", "schema", "schemas", "constants", "config"} or name.endswith(
        (".types.ts", ".schema.ts", ".constants.ts", ".config.ts")
    ):
        return Budget(900, "types-or-config")

    if any(segment == "pages" for segment in segments) or name in {"app.tsx", "app.ts"} or name.endswith("page.tsx"):
        return Budget(650, "page-or-app")

    if any(segment == "components" for segment in segments) or any(
        token in stem for token in ("form", "dialog", "panel", "modal")
    ):
        return Budget(500, "ui-component")

    if any(
        token in stem
        for token in ("service", "controller", "manager", "runtime", "loop", "router", "provider")
    ):
        return Budget(600, "orchestrator")

    if path_text.startswith("scripts/") or any(segment == "scripts" for segment in segments):
        return Budget(500, "script")

    return Budget(400, "default")


def suggest_seam(path_text: str) -> str:
    stem = PurePosixPath(path_text).stem.lower()
    if any(token in stem for token in ("service", "runtime", "loop", "router", "controller")):
        return "extract orchestration, IO, and state transitions into separate modules"
    if any(token in stem for token in ("form", "page", "app", "panel", "dialog")):
        return "extract hooks, sections, and normalization helpers out of the UI shell"
    if "test" in stem or "spec" in stem:
        return "split fixtures/builders from behavior-focused test cases"
    return "split mixed responsibilities into smaller domain-focused modules"


def inspect_paths(paths: Iterable[str]) -> dict[str, object]:
    inspected: list[str] = []
    findings: list[Finding] = []

    for raw_path in paths:
        path_text = normalize_path(raw_path)
        if not path_text or not is_code_path(path_text):
            continue
        absolute_path = ROOT / path_text
        if not absolute_path.exists() or not absolute_path.is_file():
            continue

        inspected.append(path_text)
        budget = choose_budget(path_text)
        current_lines = count_lines(path_text)
        previous_lines = get_head_lines(path_text)
        delta_lines = None if previous_lines is None else current_lines - previous_lines
        seam = suggest_seam(path_text)

        if previous_lines is None and current_lines > budget.max_lines:
            findings.append(
                Finding(
                    level="error",
                    path=path_text,
                    category=budget.category,
                    budget=budget.max_lines,
                    current_lines=current_lines,
                    previous_lines=previous_lines,
                    delta_lines=delta_lines,
                    message="new file exceeds maintainability budget",
                    suggested_seam=seam,
                )
            )
            continue

        if previous_lines is not None and previous_lines <= budget.max_lines < current_lines:
            findings.append(
                Finding(
                    level="error",
                    path=path_text,
                    category=budget.category,
                    budget=budget.max_lines,
                    current_lines=current_lines,
                    previous_lines=previous_lines,
                    delta_lines=delta_lines,
                    message="file crossed from within budget to over budget",
                    suggested_seam=seam,
                )
            )
            continue

        if previous_lines is not None and previous_lines > budget.max_lines and current_lines > previous_lines:
            findings.append(
                Finding(
                    level="error",
                    path=path_text,
                    category=budget.category,
                    budget=budget.max_lines,
                    current_lines=current_lines,
                    previous_lines=previous_lines,
                    delta_lines=delta_lines,
                    message="already oversized file kept growing",
                    suggested_seam=seam,
                )
            )
            continue

        if current_lines > budget.max_lines:
            findings.append(
                Finding(
                    level="warn",
                    path=path_text,
                    category=budget.category,
                    budget=budget.max_lines,
                    current_lines=current_lines,
                    previous_lines=previous_lines,
                    delta_lines=delta_lines,
                    message="file remains over its maintainability budget",
                    suggested_seam=seam,
                )
            )
            continue

        if current_lines >= int(budget.max_lines * 0.8):
            findings.append(
                Finding(
                    level="warn",
                    path=path_text,
                    category=budget.category,
                    budget=budget.max_lines,
                    current_lines=current_lines,
                    previous_lines=previous_lines,
                    delta_lines=delta_lines,
                    message="file is near its maintainability budget",
                    suggested_seam=seam,
                )
            )
            continue

        if delta_lines is not None and delta_lines >= 120:
            findings.append(
                Finding(
                    level="warn",
                    path=path_text,
                    category=budget.category,
                    budget=budget.max_lines,
                    current_lines=current_lines,
                    previous_lines=previous_lines,
                    delta_lines=delta_lines,
                    message="file grew materially in this change",
                    suggested_seam=seam,
                )
            )

    findings.sort(key=lambda item: (item.level != "error", item.path))
    return {
        "applicable": len(inspected) > 0,
        "inspected_paths": inspected,
        "summary": {
            "errors": sum(1 for item in findings if item.level == "error"),
            "warnings": sum(1 for item in findings if item.level == "warn"),
        },
        "findings": [
            {
                "level": item.level,
                "path": item.path,
                "category": item.category,
                "budget": item.budget,
                "current_lines": item.current_lines,
                "previous_lines": item.previous_lines,
                "delta_lines": item.delta_lines,
                "message": item.message,
                "suggested_seam": item.suggested_seam,
            }
            for item in findings
        ],
    }


def print_human(report: dict[str, object]) -> None:
    if not report["applicable"]:
        print("Maintainability check not applicable: no changed code-like files found.")
        return

    inspected_paths = report["inspected_paths"]
    summary = report["summary"]
    findings = report["findings"]
    print("Maintainability check report")
    print(f"Inspected files: {len(inspected_paths)}")
    print(f"Errors: {summary['errors']}")
    print(f"Warnings: {summary['warnings']}")

    if not findings:
        print("No maintainability findings.")
        return

    for item in findings:
        delta = item["delta_lines"]
        delta_text = "n/a" if delta is None else f"{delta:+d}"
        previous = item["previous_lines"]
        previous_text = "new" if previous is None else str(previous)
        print(
            f"- [{item['level']}] {item['path']} "
            f"(current={item['current_lines']}, previous={previous_text}, delta={delta_text}, budget={item['budget']})"
        )
        print(f"  {item['message']}")
        print(f"  seam: {item['suggested_seam']}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check maintainability drift for changed files or explicit paths.")
    parser.add_argument("--paths", nargs="*", default=None, help="Explicit paths to inspect instead of git working tree changes.")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of a human-readable report.")
    parser.add_argument("--no-fail", action="store_true", help="Always exit with code 0.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    paths = args.paths if args.paths else list_changed_paths()
    report = inspect_paths(paths)

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print_human(report)

    if args.no_fail:
        return 0
    return 1 if report["summary"]["errors"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${DIARY_E2E_DATA:-/tmp/diary-e2e/data}"
CONFIG="${DIARY_E2E_CONFIG:-/tmp/diary-e2e/config}"

rm -rf "$DATA" "$CONFIG"
mkdir -p "$DATA" "$CONFIG"

export DIARY_DATA_DIR="$DATA"
export DIARY_CONFIG_DIR="$CONFIG"
export DIARY_HOST="127.0.0.1"
export DIARY_PORT="8126"
export DIARY_AI_READ_TOKEN="e2e-read"
export DIARY_AI_WRITE_TOKEN="e2e-write"

cd "$ROOT"
python3 - "$DATA" <<'PY'
import sys
from pathlib import Path

from diary.store import add_entry, initialize

database = Path(sys.argv[1]) / "diary.sqlite3"
initialize(database)
for day in [f"2026-10-{number:02d}" for number in range(10, 20)]:
    add_entry(database, day, f"Entry for {day}", f"Body for {day}.")
add_entry(
    database,
    "2026-10-21",
    "Diary — Deep links added",
    "Deep links and **icons**.\n\n"
    "**Changed**\n"
    "- Hash routes for dates.\n"
    "- Reader tabs for documents.\n\n"
    "### Detail\n"
    "The route helper is `ROUTE.docs`.",
    author="opencode/deepseek-v4.1-flash-free",
)
for index in range(7):
    author = "AI" if index % 2 else "opencode/deepseek-v4.1-flash-free"
    add_entry(database, "2026-10-22", f"Today {index + 1}", f"Body {index + 1}.", author=author)
PY

exec python3 -m diary serve

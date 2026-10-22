"""Import legacy YYYY-MM-DD Markdown logs without changing their source files."""

from datetime import date
import hashlib
import re
from pathlib import Path

from diary.store import add_entry, valid_day


SECTION = re.compile(r"^##\s+(?:\d+\.\s*)?(.+?)\s*$")


def split_log(markdown: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    current_title = ""
    current_lines: list[str] = []
    for line in markdown.splitlines():
        match = SECTION.match(line)
        if match:
            if current_title or any(part.strip() for part in current_lines):
                sections.append((current_title or "Daily summary", "\n".join(current_lines).strip()))
            current_title = match.group(1).strip()
            current_lines = []
        else:
            current_lines.append(line)
    if current_title or any(part.strip() for part in current_lines):
        sections.append((current_title or "Daily summary", "\n".join(current_lines).strip()))
    return [(title, content) for title, content in sections if content]


def import_directory(database_path: Path, source_dir: Path) -> dict[str, int]:
    imported = 0
    skipped = 0
    files = sorted(source_dir.glob("????-??-??.md"))
    for path in files:
        day = path.stem
        if not valid_day(day):
            skipped += 1
            continue
        markdown = path.read_text(encoding="utf-8")
        for title, content in split_log(markdown):
            key = hashlib.sha256(f"{day}\0{title}\0{content}".encode("utf-8")).hexdigest()
            inserted = add_entry(database_path, day, title, content, key)
            if inserted is None:
                skipped += 1
            else:
                imported += 1
    return {"imported": imported, "skipped": skipped, "files": len(files)}

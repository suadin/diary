"""Split the project README into pages for the browser reader."""

from pathlib import Path
import re


SECTION = re.compile(r"^##\s+(.+?)\s*$")


def readme_pages(path: Path) -> dict[str, object]:
    """Return the document title and one page per level-two heading."""
    title = "Diary"
    pages: list[dict[str, str]] = []
    current_title = "Overview"
    current_lines: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# ") and not pages and not any(part.strip() for part in current_lines):
            title = line[2:].strip()
            continue
        match = SECTION.match(line)
        if match:
            body = "\n".join(current_lines).strip()
            if body:
                pages.append({"title": current_title, "markdown": body})
            current_title = match.group(1).strip()
            current_lines = []
            continue
        current_lines.append(line)
    body = "\n".join(current_lines).strip()
    if body:
        pages.append({"title": current_title, "markdown": body})
    return {"title": title, "pages": pages}

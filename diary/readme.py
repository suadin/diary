"""Split Markdown documents into pages for the browser reader."""

from pathlib import Path
import re


SECTION = re.compile(r"^##\s+(.+?)\s*$")
SLUG = re.compile(r"[^a-z0-9]+")


def _slug(value: str) -> str:
    return SLUG.sub("-", value.lower()).strip("-") or "page"


def readme_pages(path: Path) -> dict[str, object]:
    """Return the document title and one page per level-two heading."""
    title = "Diary"
    pages: list[dict[str, str]] = []
    current_title = "Overview"
    current_lines: list[str] = []
    used: dict[str, int] = {}

    def append_page(page_title: str, body: str) -> None:
        slug = _slug(page_title)
        count = used.get(slug, 0)
        used[slug] = count + 1
        if count:
            slug = f"{slug}-{count + 1}"
        pages.append({"title": page_title, "slug": slug, "markdown": body})

    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# ") and not pages and not any(part.strip() for part in current_lines):
            title = line[2:].strip()
            continue
        match = SECTION.match(line)
        if match:
            body = "\n".join(current_lines).strip()
            if body:
                append_page(current_title, body)
            current_title = match.group(1).strip()
            current_lines = []
            continue
        current_lines.append(line)
    body = "\n".join(current_lines).strip()
    if body:
        append_page(current_title, body)
    return {"title": title, "pages": pages}


def documents(root: Path) -> list[dict[str, object]]:
    """Return the README and the Markdown documents under docs/."""
    candidates: list[tuple[str, str, Path]] = [("readme", "README", root / "README.md")]
    for path in sorted((root / "docs").glob("*.md")):
        if path.name == "AI-SKILL.md":
            continue
        candidates.append((_slug(path.stem), path.stem.replace("_", " ").title(), path))
    result: list[dict[str, object]] = []
    for slug, title, path in candidates:
        if not path.is_file():
            continue
        page = readme_pages(path)
        result.append({"slug": slug, "title": title, "pages": page["pages"]})
    return result

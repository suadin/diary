"""Split Markdown documents into pages for the browser reader."""

from pathlib import Path
import re


SECTION = re.compile(r"^##\s+(.+?)\s*$")
SLUG = re.compile(r"[^a-z0-9]+")


def _slug(value: str) -> str:
    return SLUG.sub("-", value.lower()).strip("-") or "page"


def readme_pages_text(markdown: str) -> dict[str, object]:
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

    for line in markdown.splitlines():
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


def readme_pages(path: Path) -> dict[str, object]:
    return readme_pages_text(path.read_text(encoding="utf-8"))


def compose_specs(app_specs: str, release_notes: str) -> str:
    """One continuous Changelog page before the app rules."""
    notes = re.sub(r"^#\s+.*$", "", release_notes, count=1, flags=re.M)
    notes = re.sub(r"^##\s+", "### ", notes, flags=re.M).strip()
    rules = re.sub(r"^#\s+.*$", "", app_specs, count=1, flags=re.M).strip()
    return f"# SPECS\n\n## Changelog\n\n{notes}\n\n{rules}\n"


def continuous_page(path: Path) -> dict[str, object]:
    """Return one page for the whole document, without an overview page."""
    lines = path.read_text(encoding="utf-8").splitlines()
    title = path.stem
    if lines and lines[0].startswith("# "):
        title = lines[0][2:].strip()
        lines = lines[1:]
    body = "\n".join(lines).strip()
    return {"title": title, "pages": [{"title": "All versions", "slug": "all", "markdown": body}]}


def documents(root: Path) -> list[dict[str, object]]:
    """Return README, SPECS and BASIC SPECS in reader order."""
    candidates = [
        ("readme", "README", root / "README.md"),
        ("app-specs", "SPECS", root / "docs" / "APP-SPECS.md"),
        ("basic-specs", "BASIC SPECS", root / "docs" / "BASIC-SPECS.md"),
    ]
    result: list[dict[str, object]] = []
    for slug, title, path in candidates:
        if not path.is_file():
            continue
        if slug == "app-specs":
            notes = root / "RELEASE-NOTES.md"
            if notes.is_file():
                page = readme_pages_text(compose_specs(path.read_text(encoding="utf-8"),
                                                       notes.read_text(encoding="utf-8")))
            else:
                page = readme_pages(path)
        else:
            page = readme_pages(path)
        result.append({"slug": slug, "title": title, "pages": page["pages"]})
    return result

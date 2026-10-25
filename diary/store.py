"""SQLite persistence and the small set of journal queries."""

from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
import sqlite3
from typing import Iterator


TOPIC_SEPARATORS = ("—", ":")


def valid_day(value: str) -> bool:
    try:
        return date.fromisoformat(value).isoformat() == value
    except (TypeError, ValueError):
        return False


def _connect(database_path: Path) -> sqlite3.Connection:
    database_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    connection = sqlite3.connect(database_path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


@contextmanager
def connection(database_path: Path) -> Iterator[sqlite3.Connection]:
    database_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with _connect(database_path) as database:
        yield database
    database_path.chmod(0o600)
    wal_path = database_path.with_name(database_path.name + "-wal")
    if wal_path.exists():
        wal_path.chmod(0o600)
    shm_path = database_path.with_name(database_path.name + "-shm")
    if shm_path.exists():
        shm_path.chmod(0o600)


def initialize(database_path: Path) -> None:
    with connection(database_path) as database:
        database.executescript(
            """
            CREATE TABLE IF NOT EXISTS entries (
                id INTEGER PRIMARY KEY,
                day TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                source_key TEXT UNIQUE,
                author TEXT NOT NULL DEFAULT 'AI'
            );
            CREATE INDEX IF NOT EXISTS entries_by_day ON entries(day DESC, id DESC);
            DROP TABLE IF EXISTS entry_tags;
            DROP TABLE IF EXISTS tags;
            """
        )
        columns = {row["name"] for row in database.execute("PRAGMA table_info(entries)")}
        if "author" not in columns:
            database.execute("ALTER TABLE entries ADD COLUMN author TEXT NOT NULL DEFAULT 'AI'")


def _entry(database: sqlite3.Connection, row: sqlite3.Row) -> dict[str, object]:
    return {
        "id": row["id"],
        "date": row["day"],
        "title": row["title"],
        "content": row["content"],
        "createdAt": row["created_at"],
        "author": row["author"],
    }


def add_entry(
    database_path: Path,
    day: str,
    title: str,
    content: str,
    source_key: str | None = None,
    author: str = "AI",
) -> int | None:
    if not valid_day(day):
        raise ValueError("date must be a real calendar date in YYYY-MM-DD format")
    title = title.strip()
    content = content.strip()
    author = " ".join(author.split()) or "AI"
    if not title or not content:
        raise ValueError("title and content are required")
    if len(title) > 200 or len(content.encode("utf-8")) > 50_000:
        raise ValueError("title or content exceeds Diary's size limit")
    if len(author) > 80:
        raise ValueError("author exceeds Diary's size limit")
    created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with connection(database_path) as database:
        try:
            cursor = database.execute(
                "INSERT INTO entries(day, title, content, created_at, source_key, author) VALUES (?, ?, ?, ?, ?, ?)",
                (day, title, content, created_at, source_key, author),
            )
        except sqlite3.IntegrityError:
            if source_key:
                return None
            raise
        return int(cursor.lastrowid)


def _entries(database_path: Path, sql: str, parameters: tuple[object, ...]) -> list[dict[str, object]]:
    with connection(database_path) as database:
        rows = database.execute(sql, parameters).fetchall()
        return [_entry(database, row) for row in rows]


def list_days(database_path: Path) -> list[dict[str, object]]:
    with connection(database_path) as database:
        rows = database.execute(
            "SELECT day, COUNT(*) AS count FROM entries GROUP BY day ORDER BY day DESC"
        ).fetchall()
        return [{"date": row["day"], "count": row["count"]} for row in rows]


def day_page(database_path: Path, offset: int, limit: int) -> dict[str, object]:
    """Return one window of days plus totals for the whole journal."""
    with connection(database_path) as database:
        rows = database.execute(
            "SELECT day, COUNT(*) AS count FROM entries GROUP BY day ORDER BY day DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        totals = database.execute(
            "SELECT COUNT(DISTINCT day) AS days, COUNT(*) AS entries FROM entries"
        ).fetchone()
        return {
            "days": [{"date": row["day"], "count": row["count"]} for row in rows],
            "offset": offset,
            "limit": limit,
            "totalDays": totals["days"],
            "totalEntries": totals["entries"],
        }


def get_entry(database_path: Path, entry_id: int) -> dict[str, object] | None:
    rows = _entries(database_path, "SELECT entries.* FROM entries WHERE entries.id = ?", (entry_id,))
    return rows[0] if rows else None


def entry_page(database_path: Path, day: str, offset: int, limit: int) -> dict[str, object]:
    """Return one window of a day's entries plus the day's total."""
    if not valid_day(day):
        raise ValueError("date must be a real calendar date in YYYY-MM-DD format")
    with connection(database_path) as database:
        rows = database.execute(
            "SELECT entries.* FROM entries WHERE entries.day = ? ORDER BY entries.id DESC LIMIT ? OFFSET ?",
            (day, limit, offset),
        ).fetchall()
        total = database.execute(
            "SELECT COUNT(*) AS total FROM entries WHERE entries.day = ?",
            (day,),
        ).fetchone()["total"]
        return {
            "date": day,
            "entries": [_entry(database, row) for row in rows],
            "offset": offset,
            "limit": limit,
            "total": total,
        }


def list_entries(database_path: Path, day: str | None = None) -> list[dict[str, object]]:
    clauses: list[str] = []
    parameters: list[object] = []
    if day:
        clauses.append("entries.day = ?")
        parameters.append(day)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return _entries(
        database_path,
        f"SELECT entries.* FROM entries {where} ORDER BY entries.day DESC, entries.id DESC",
        tuple(parameters),
    )


def entry_topic(title: str) -> str | None:
    """Return the topic before the first separator in a title, or None."""
    for separator in TOPIC_SEPARATORS:
        if separator in title:
            topic, _, _ = title.partition(separator)
            topic = topic.strip()
            return topic if topic else None
    return None


def top_tags(database_path: Path, limit: int | None = None) -> list[dict[str, object]]:
    """Return title topics ordered by frequency; newest spelling wins."""
    with connection(database_path) as database:
        rows = database.execute("SELECT title FROM entries ORDER BY id DESC").fetchall()
    counts: dict[str, int] = {}
    display: dict[str, str] = {}
    for row in rows:
        topic = entry_topic(row["title"])
        if topic is None:
            continue
        key = topic.casefold()
        counts[key] = counts.get(key, 0) + 1
        display.setdefault(key, topic)
    ordered = sorted(counts.items(), key=lambda item: (-item[1], display[item[0]].casefold()))
    selected = ordered if limit is None else ordered[:limit]
    return [{"tag": display[key], "count": count} for key, count in selected]


def search_entries(database_path: Path, query: str, tag: str | None = None) -> list[dict[str, object]]:
    term = query.strip()
    clauses: list[str] = []
    parameters: list[object] = []
    if term:
        escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        clauses.append(
            "(entries.title LIKE ? ESCAPE '\\' OR entries.content LIKE ? ESCAPE '\\')"
        )
        parameters.extend((pattern, pattern))
    if tag:
        clauses.append(
            "(instr(entries.title, '—') > 0 OR instr(entries.title, ':') > 0)"
            " AND ("
            " (instr(entries.title, '—') > 0 AND lower(trim(substr(entries.title, 1, instr(entries.title, '—') - 1))) = lower(?))"
            " OR (instr(entries.title, ':') > 0 AND lower(trim(substr(entries.title, 1, instr(entries.title, ':') - 1))) = lower(?))"
            ")"
        )
        parameters.extend((tag.strip(), tag.strip()))
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return _entries(
        database_path,
        f"SELECT entries.* FROM entries {where} ORDER BY entries.day DESC, entries.id DESC",
        tuple(parameters),
    )


def delete_entries(database_path: Path, day: str | None = None, before: str | None = None) -> int:
    selected = sum(value is not None for value in (day, before))
    if selected != 1:
        raise ValueError("choose exactly one deletion filter: date or before")
    with connection(database_path) as database:
        if day:
            if not valid_day(day):
                raise ValueError("date must be a real calendar date in YYYY-MM-DD format")
            cursor = database.execute("DELETE FROM entries WHERE day = ?", (day,))
        elif before:
            if not valid_day(before):
                raise ValueError("date must be a real calendar date in YYYY-MM-DD format")
            cursor = database.execute("DELETE FROM entries WHERE day <= ?", (before,))
        return cursor.rowcount

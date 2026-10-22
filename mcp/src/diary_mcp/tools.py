"""Tool implementations for the Diary MCP server."""

import json

from .api import DiaryAPI


def _api() -> DiaryAPI:
    return DiaryAPI()


def append_entry_tool(day: str, title: str, content: str) -> str:
    result = _api().append_entry(day, title, content)
    return json.dumps(
        {"ok": True, "id": result.get("id"), "date": day, "title": title},
        ensure_ascii=False,
    )


def search_tool(query: str = "") -> str:
    entries = _api().search(query)
    return json.dumps(
        {"count": len(entries), "query": query, "entries": entries},
        ensure_ascii=False,
    )


def list_days_tool() -> str:
    days = _api().list_days()
    return json.dumps({"days": days}, ensure_ascii=False)


def skill_tool() -> str:
    return _api().skill()

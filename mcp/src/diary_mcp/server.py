"""MCP server for the Diary instance on the NAS."""

import sys

from fastmcp import FastMCP

from .tools import append_entry_tool, list_days_tool, search_tool, skill_tool

mcp = FastMCP("Diary MCP Server")


@mcp.tool()
def diary_append_entry(day: str, title: str, content: str) -> str:
    """
    Append one entry to the Diary on the NAS.

    Appending is the only write the AI credential may do. Existing entries
    cannot be edited or deleted through this tool; only a human can remove
    them in the web interface.

    Use one entry per coherent topic. Several entries may share a day. Keep
    numbers, commit IDs, paths and test outcomes when they help future work.
    Never invent outcomes, measurements, decisions or user preferences.

    Args:
        day: Local calendar date in YYYY-MM-DD format.
        title: Short, specific title (at most 200 characters).
        content: Concise Markdown describing what happened, what was verified
            and what remains open (at most 50 KB).

    Returns:
        JSON string with ok, id, date and title of the new entry.
    """
    return append_entry_tool(day=day, title=title, content=content)


@mcp.tool()
def diary_search(query: str = "") -> str:
    """
    Search Diary entry titles and content, newest first.

    Use this before writing to avoid duplicating an existing entry and to
    recover what earlier sessions decided.

    Args:
        query: Text to look for in titles and content. Omit to list all
            entries.

    Returns:
        JSON string with count and entries; each entry has id, date, title,
        content and createdAt.
    """
    return search_tool(query=query)


@mcp.tool()
def diary_list_days() -> str:
    """
    List the days that have entries, newest first, with the entry count.

    Returns:
        JSON string with a days array of {date, count}.
    """
    return list_days_tool()


@mcp.tool()
def diary_get_skill() -> str:
    """
    Read the human-editable AI writing guide stored in Diary.

    Read this when the expected format or scope of an entry is uncertain.
    The guide is editable in the web interface; the AI credential can only
    read it.

    Returns:
        The guide as Markdown.
    """
    return skill_tool()


def main() -> None:
    """Start the MCP server over stdio."""
    print("Diary MCP server starting (stdio).", file=sys.stderr)
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()

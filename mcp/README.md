# Diary MCP

An optional [Model Context Protocol](https://modelcontextprotocol.io/) server so an
AI assistant can search Diary and append entries over stdio, using the same HTTP API
and credentials as any other client. It contains no logic of its own: Diary enforces
that the write credential can append but never edit or delete.

## Tools

| Tool | Credential | Purpose |
|---|---|---|
| `diary_append_entry(day, title, content)` | write | Append one entry |
| `diary_search(query)` | read | Full-text search in titles and content |
| `diary_list_days()` | none | Days with entry counts |
| `diary_get_skill()` | read | The human-editable AI writing guide |

## Configuration

Everything is taken from the environment:

| Variable | Default | Meaning |
|---|---|---|
| `DIARY_API_URL` | `http://127.0.0.1:8125` | Base URL of the Diary instance |
| `DIARY_AI_READ_TOKEN` | — | Read credential as a value |
| `DIARY_AI_READ_TOKEN_FILE` | — | File containing the read credential |
| `DIARY_AI_WRITE_TOKEN` | — | Write credential as a value |
| `DIARY_AI_WRITE_TOKEN_FILE` | — | File containing the write credential |

Set the value or the file for each credential; the value wins when both are set.
The credentials file created by `python3 -m diary setup` is not parsed directly —
pass its two values, or keep separate token files.

## Run

```bash
cd mcp
uv venv
uv pip install -e .
DIARY_AI_READ_TOKEN_FILE=~/.config/diary/ai-read.token \
DIARY_AI_WRITE_TOKEN_FILE=~/.config/diary/ai-write.token \
.venv/bin/diary-mcp
```

Without an install, `python main.py` from this directory works too; it adds `src/`
to the import path itself. Python 3.12 or newer is needed because FastMCP requires
it — the Diary application itself still runs on 3.10.

The configuration logic has its own tests; they need no network and no running
instance:

```bash
cd mcp
PYTHONPATH=src python -m unittest discover -s tests
```

## Recommended layout for a personal installation

Keep this code in the repository. The assistant's own MCP directory should hold only
the virtualenv and a link to `mcp/main.py`, plus the concrete URL and token paths in
the assistant's configuration. A copied MCP would drift from the repository, and a
token or NAS address committed here would make the repository unfit to publish.

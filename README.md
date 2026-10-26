# Diary

**Diary is a private, local memory for future AI sessions.** It turns daily Markdown
logs into dated, searchable entries. A human can read and curate the history; an AI
can search it and append new entries without being able to rewrite the writing rules
or erase history.

This README explains what Diary is, how to run it, and how to operate it. The reusable
rules live in [BASIC SPECS](docs/BASIC-SPECS.md); the Diary-specific rules live in
[APP SPECS](docs/APP-SPECS.md). Changes by version are in [RELEASE NOTES](RELEASE-NOTES.md).

> 🗂️ Dated entries · 🔗 deep links to every view · 🤖 append-only AI access ·
> 🧪 51 unit tests and 27 E2E journeys

## What it does

- Lists dates newest-first, seven per page, in `YYYY-MM-DD` form. Arrows load the
  previous or next window on demand; a date opens with its entries, eight at a time,
  and the entry list pages lazily as well. A coarse `hh24:mi` sits beside each date;
  entries without a same-day timestamp show `12:00`. Arrow buttons walk to the
  neighbouring date with a short slide, even across a page boundary.
- A round badge counts all entries. It stays neutral while the journal is small,
  turns amber from 2,000 entries, and red from 5,000 — the range where whole-journal
  requests (search and Memory spark) start to hurt.
- Opens entries on the main page and searches titles and text. Search results always
  show their date; previews are deliberately compact. An entry view shows date, time,
  and author, and can copy its own link. Stored Markdown renders with the document
  reader's typography — paragraphs, lists, headings, code, tables, and links.
- Shows the eight most frequent title topics as tag chips in the sidebar, ties going to
  the topic used most recently. A chip filters the journal by that exact topic; topics
  come from the part before the earliest separator (`—` or `:`) in a title, so the chips
  need no separate tagging step.
- Search works inside the current scope: with a tag selected it searches that tag, with
  a date selected it searches that date, and the entry count in the sidebar opens every
  entry before searching. The search text is part of the address, so a link restores it.
  Results are paged eight at a time, and an open entry steps to the neighbours in the
  list it came from.
- Links are stable and shareable: `#/day/2026-10-22`, `#/entry/42`,
  `#/docs/readme/ai-api`, `#/docs/release-notes`, `#/guide`, `#/all?q=boot`, and
  `#/tag/Diary?q=boot`. Opening one restores the same view, including the surrounding
  sidebar window; a refresh does not flash the welcome panel first.
- Keeps the writing guide and the documentation apart: the guide is editable; the
  README, the release notes, and the SPECS under `docs/` are read-only. Documentation
  opens in the main panel with one tab per document and one icon per heading; the icon
  tooltip names the section, and clicking it opens that page with its heading. The AI
  guide seed is not part of the reader.
- Keeps the AI writing guide editable from the local web page, without a sign-in flow.
  The editor shows seven lines and can be expanded, so the delete controls stay visible.
  **Reset** restores the built-in default from `docs/AI-SKILL.md`.
- Lets the local human delete entries for one day or through a date (inclusive), both
  entered as `yyyy-mm-dd`. Every destructive action asks for confirmation.
- Provides a read-only AI skill and history-search API, plus a separate append-only
  AI entry endpoint.
- Shows the latest unit-test count and coverage, plus the Playwright E2E
  numbers, in a compact centred footer separated by `|`. The unit button starts the
  suite once and then polls until it finishes; once results exist it shows them and
  refuses to run again. E2E results are display-only in the container.
- Includes a small purple **Memory spark** button that resurfaces a random older entry.
- Serves this README, the release notes, and the SPECS under `docs/`: a book icon in
  the footer opens the reader, one page per heading, with a row of section icons
  instead of arrows. The editable AI guide has its own editor and is not duplicated in
  the reader.
- Follows the operating system's light/dark preference and links to this repository.

The interface follows the workspace contract: README, source, and test numbers in one
centred footer; deep links; paging and lazy loading; `yyyy-mm-dd` and `hh24:mi`;
quiet colours with a playful edge; one name for one thing.

## Local setup

Diary needs Python 3.10 or newer and SQLite (included with Python). It has no
third-party runtime dependencies. The optional MCP client in `mcp/` is the one
exception: it needs Python 3.12 and FastMCP.

```bash
git clone https://github.com/suadin/diary.git
cd diary
python3 -m diary setup
python3 -m diary test
python3 -m diary serve
```

Open <http://127.0.0.1:8125/>. `setup` creates a private data directory and
`~/.config/diary/credentials.env` with separate random credentials for AI history
reads and AI entry writes. The file and data are outside the repository and have
owner-only permissions. Keep the credentials file private and give the AI credentials
only to the corresponding local assistant integration. The browser does not require
a human password; Diary is intended for local use only.

The default database is `~/.local/share/diary/diary.sqlite3`; the editable skill is
`~/.local/share/diary/AI-SKILL.md`. Set `DIARY_DATA_DIR` and `DIARY_CONFIG_DIR` to
move them. `DIARY_HOST` may only be a loopback address. `DIARY_PORT` defaults to
`8125`.

## Manual NAS deployment

The optional Docker Compose deployment adds an HTTPS reverse proxy, has no
CI/CD pipeline, and leaves the Diary HTTP server bound to loopback on the NAS.
It listens on HTTPS port `8444`. Copy the source tree to the NAS without `.git`,
local data, or credentials, then configure `deploy/.env` there:

```dotenv
DIARY_PUBLIC_ORIGIN=https://<NAS-IP>:8444
DIARY_DATA_DIR_ON_HOST=/path/on/nas/diary/data
DIARY_CONFIG_DIR_ON_HOST=/path/on/nas/diary/config
DIARY_TLS_FULLCHAIN_ON_HOST=/path/to/trusted/fullchain.crt
DIARY_TLS_KEY_ON_HOST=/path/to/trusted/tls.key
```

Use the NAS IP or local DNS name covered by the certificate, and keep the TLS
private key and `.env` outside Git. Then start the stack from `deploy/`:

```bash
docker compose up -d --build
docker compose ps
```

Open `https://<NAS-IP>:8444/`. The first start creates the AI credentials in the
configured private config directory. The NAS deployment uses host networking so
the application listens only on `127.0.0.1:8125`, while nginx terminates HTTPS
and forwards the exact origin to Diary. Port `8444` must be available. Do not
expose the port beyond a trusted LAN or publish the service through a tunnel.

To import existing dated Markdown logs without changing or deleting the originals:

```bash
python3 -m diary import ~/dev/logs
```

The importer turns each level-two section into an entry and keeps any introductory
text as a “Daily summary” entry. It uses a stable fingerprint so repeating the import
does not duplicate entries. Source files remain untouched.

## AI API

Send an `Authorization: Bearer <token>` header with AI requests. The token values are
in the private credentials file; do not put them in this repository.

```http
GET /ai/skill
GET /ai/search?q=boot
POST /ai/entries
```

`GET /ai/skill` and `GET /ai/search` require the read credential. `POST /ai/entries`
requires the separate write credential and accepts only `date`, `title`, `content`,
and an optional `author` as JSON. For AI work the author is the model name, for
example `opencode/deepseek-v4.1-flash-free`; imported history uses `AI`; a human
writing through the API may use their own name. The field defaults to `AI` and is
limited to 80 characters. That credential can only append entries; there is no AI
endpoint for editing or deleting. Titles name topic and action, joined by an em dash,
for example `Diary — README reader added`, so tags can group entries by topic. The web
search matches titles and content and narrows by tag or date; the AI search endpoint
accepts only the `q` text. Tags are the exact title topic before the earliest em dash or
colon; the sidebar chips and the `tag` search parameter filter by them. The server binds
only to loopback and does not enable CORS.

## Web endpoints

The page uses a same-origin API; browser mutations additionally require the
same-origin check described below.

```http
GET /api/days                          # every day with its entry count
GET /api/days/page?offset=0&limit=7    # one window plus total days and entries
GET /api/entries?date=2026-10-22
GET /api/entries/page?date=2026-10-22&offset=0&limit=8   # one window plus the day's total
GET /api/entry?id=42                   # one entry for a deep link
GET /api/search?q=boot
GET /api/search?q=boot&tag=Diary      # text and exact title topic
GET /api/search?q=boot&date=2026-10-22  # text and one date
GET /api/search/page?q=boot&tag=Diary&offset=0&limit=8   # one window plus the total
GET /api/tags                          # title topics by frequency, default 8
GET /api/tags?limit=8                  # explicit limit, 1 to 50
GET /api/skill
GET /api/docs                          # README, RELEASE-NOTES.md, and docs/*.md, split into pages
GET /api/metrics                       # unit and end-to-end numbers, and whether a run is active
POST /api/tests                        # start the unit suite once; 409 when results exist
POST /api/skill/reset                  # restore the seed guide
PUT /api/skill
DELETE /api/entries
```

## AI client (MCP)

`mcp/` holds an optional Model Context Protocol server that exposes the AI API as
four tools (`append`, `search`, `list days`, `read skill`) over stdio. `append` takes
the optional `author` field described above. It is generic
tooling and is configured only through `DIARY_API_URL`, `DIARY_AI_READ_TOKEN` and
`DIARY_AI_WRITE_TOKEN` — or the matching `*_TOKEN_FILE` variables. It carries no
address, token, or path from a particular installation.

```bash
cd mcp
uv venv
uv pip install -e .
DIARY_AI_READ_TOKEN_FILE=~/.config/diary/ai-read.token \
DIARY_AI_WRITE_TOKEN_FILE=~/.config/diary/ai-write.token \
.venv/bin/diary-mcp
```

**Recommended layout for a personal installation:** keep the MCP in this repository
and let the assistant's own MCP directory hold only the virtualenv, a link to
`mcp/main.py`, and the concrete URL and token paths in the assistant's
configuration. A copied server would drift; a committed address or token would make
the repository unfit to publish. Details are in [`mcp/README.md`](mcp/README.md).

## Human controls

The local web page does not have a sign-in flow. Browser mutations require a
same-origin request to the loopback server; the same-origin check is not an
authentication mechanism for a server exposed to a LAN or the internet. For the
documented HTTPS proxy deployment, configure the exact HTTPS origin in
`DIARY_PUBLIC_ORIGIN`; requests with a different origin or Host are rejected.

Delete controls preview the matching entry count before confirmation. They support one
calendar day or all entries dated on or before a selected day, both entered as
`yyyy-mm-dd` text. The date cutoff is inclusive. The source Markdown files are never
deleted by Diary.

## Tests and coverage

The rules this section proves are in
[BASIC SPECS › Tests](docs/BASIC-SPECS.md#tests).

Run `python3 -m diary test` after a change, or use the quiet test button in the page
footer. Both use Python's standard-library test runner and line tracing; the count
and coverage percentage are saved in the private data directory and shown in the
footer. The button polls every five seconds while a run is active. It is a one-shot
control: as soon as `test-metrics.json` exists the button shows the result and the
server refuses another start with `409`. Remove that file from the private data
directory to measure a new state. The Docker image ships `tests/`, the README, the
release notes, and `docs/` so the button and the documentation reader work in the NAS
deployment.
Coverage measures executable application lines in the server, store, importer,
configuration, and test-runner modules; it is line coverage, not branch coverage.
A missing report is shown as “not measured”, not as zero.

Tests trace back to the rules they protect: a unit test declares its requirement with
a `covers` tag, an E2E journey with a Playwright tag. The server merges both runs,
and every page in BASIC SPECS and APP SPECS lists the concrete test names under
“Automated tests”, so a rule without a test is visible instead of implied.

The unit suite has 51 tests and currently covers 489 of 636 lines (76.9 %). The
Playwright suite in `e2e/` has 27 journeys and touches 861 of 1197 `web/app.js` lines
(71.9 %). It needs Node, pnpm, and a Chromium build:

```bash
cd e2e
pnpm install
pnpm exec playwright install chromium
pnpm test
```

The run starts its own Diary on `127.0.0.1:8126` with a throwaway journal under
`/tmp/diary-e2e`, writes `e2e/test-metrics.e2e.json`, and leaves that file out of
Git. Copy the file into the private data directory as `test-metrics.e2e.json` to show
the numbers in the footer; the container never runs Playwright itself.

## Project map

| Path | Purpose |
|---|---|
| `diary/server.py` | Local HTTP API, same-origin human mutations, AI permissions, static files |
| `diary/store.py` | SQLite schema, entries, text search, deletion |
| `diary/importer.py` | Idempotent import of dated Markdown files |
| `diary/readme.py` | Splits the README, release notes, and `docs/*.md` into pages for the reader |
| `diary/config.py` | XDG paths, local credentials, setup |
| `diary/coverage.py` | Test suite execution and standard-library line coverage |
| `diary/testrunner.py` | Starts a test run from the page and blocks duplicate runs |
| `RELEASE-NOTES.md` | Version history, read-only in the documentation reader |
| `web/` | Small, dependency-free browser interface (deep links, paging, documents, quiet test button) |
| `e2e/` | Playwright journeys and the end-to-end metrics reporter |
| `docs/AI-SKILL.md` | Seed for the human-editable AI writing guide |
| `docs/BASIC-SPECS.md` | Reusable, testable rules for a small local app |
| `docs/APP-SPECS.md` | Diary-specific, testable product rules |
| `mcp/` | Optional MCP client for AI assistants, configured by environment |
| `tests/` | Storage, import, and HTTP/API checks |

## Data and trust boundaries

Diary is intended for one user's local machine, not as a public or LAN server. The
repository contains no logs, credentials, or database. SQLite and the editable skill
live under the user's XDG data directory; generated credentials live under XDG config.
AI read and write tokens are distinct, and the AI writer cannot update or delete
through its API credentials. Same-origin checks stop cross-origin browser requests;
they do not authenticate a local process or another user with access to this machine.
The loopback server should only be reachable through the documented HTTPS reverse
proxy on a trusted LAN; do not expose it directly or publish it through an external
tunnel.

# Diary specs

Diary is a small, local web journal whose primary reader is a future AI session.
The web app, API, documentation, and code are English-only; imported historical
Markdown is preserved as written.

This document lists the rules Diary must satisfy: what must be true, not how to run
it. [README](../README.md) explains setup, operation, and deployment.

## Entries and writing

What an entry is, and who may write one.

- Entries have a calendar date, title, Markdown content, and an author. Multiple
  entries may belong to a date; search matches titles and content only.
- The entry view renders that Markdown with the same typography as the document
  reader. Wrapped lines join into paragraphs; `-` starts a list, `###` a heading,
  backticks code, and links stay clickable. Stored text is not altered.
- A title names topic and action, joined by an em dash: `Topic — Action`, for example
  `Diary — README reader added`. The topic is a stable word so tags can group
  entries; the action says what was done.
- The author is the model name for AI work, for example
  `opencode/deepseek-v4.1-flash-free`, `AI` for imported history, or a human name
  given through the API. It defaults to `AI` and is limited to 80 characters.
- Entry views show date and time side by side, the author, and a button that copies a
  deep link. Entry lists show the date and a coarse `hh24:mi`; entries without a
  same-date timestamp show `12:00`.

## Navigation and deep links

How a reader reaches a date, an entry, or a section.

- The page lists dates newest-first in `yyyy-mm-dd` form, seven per page; arrows load
  older or newer windows on demand. A date shows its entries five per page with lazy
  loading, and arrows step to the neighbouring date, including across a page boundary.
- Deep links are first-class: `#/day/2026-10-22`, `#/entry/42`,
  `#/docs/readme/ai-api`, `#/guide`, `#/search/boot`, and `#/tag/Diary`. Opening one
  restores the same view and the surrounding sidebar window; an unknown link returns to
  the start.
- Search matches titles and content with dates in the results. Entry previews are
  compact.
- The sidebar shows at most the ten most frequent title topics as tag chips. A chip
  filters entries by the exact topic before the em dash; no separate tagging step is
  needed.

## Documentation reader

How the README and `docs/*.md` are read in the page.

- The footer serves the documentation: a book icon opens the README in the main panel.
  The reader also lists the Markdown files under `docs/`, one tab per document and one
  page per level-two heading.
- Sections are navigated by a row of icons, not arrows. Each icon symbolises its
  section, its tooltip gives the section title, and a click opens that page with its
  heading. Long documents reduce the font size instead of widening the page.
- Relative Markdown links between documents open in the reader. The same links keep
  working on GitHub, and each section has a stable anchor.

## Writing guide

What the editable AI guide does.

- The AI writing guide is separate from the read-only documents: it is editable in the
  page, five lines tall by default, expandable, with a reset to the built-in default.
- The guide describes the entry shape and the writing rules. It is the single place
  those rules live; the page does not repeat them.

## Footer

What the page points to.

- One compact, centred footer carries README, source, unit tests, and E2E tests,
  separated by `|`. Each item has its own icon and must stay on one line at desktop
  width.
- The items name what they open: the documentation reader, the source repository, the
  unit report, and the E2E report. A failure count appears only when at least one test
  failed, and then in red.

## Tests

What the page claims about its own state.

Run commands and measured numbers are in
[README › Tests and coverage](../README.md#tests-and-coverage).

- The unit button shows the latest count and application line coverage and starts the
  suite once. Results are one-shot: once they exist the button shows them and refuses
  another start. It polls every five seconds while a run is active.
- The E2E item shows Playwright journeys and `web/app.js` line coverage from
  `test-metrics.e2e.json`. Playwright runs locally, not in the container; a missing
  file shows “not measured”, never zero.
- Coverage is line coverage, not branch coverage. A missing unit report is shown as
  “not measured”, not as zero.
- Tests cover the API, storage, search, deletion, AI/human mutation boundaries, deep
  links, and legacy Markdown import.
- Every automated test names the rule it protects: unit tests carry a `covers` tag,
  E2E journeys a Playwright tag. Each SPECS page lists the concrete test names under
  “Automated tests”, unit methods as readable sentences and numbered below their
  group; a section without names is a gap, not a pass.
- Test tooltips name the measurement time and duration, not a second copy of the
  numbers already in the footer.

## Human controls

What the local human may change without a sign-in.

- The local human can edit the AI writing guide and delete entries by date or through
  an inclusive date without signing in. Browser mutations require a same-origin
  loopback request, or the explicitly configured HTTPS origin behind a local reverse
  proxy.
- Delete controls take dates as `yyyy-mm-dd` in plain text fields. Every destructive
  action previews the count and asks for confirmation.
- A round badge shows the total entry count. It stays neutral below 2,000 entries,
  turns amber at 2,000, and red at 5,000, the range where whole-journal requests
  (search, Memory spark) become a risk.

## AI API

What the AI credential may do.

- AI reads the writing guide and searches history over read-only `GET /ai/skill` and
  `GET /ai/search` endpoints. It can append a new entry through a separate
  `POST /ai/entries` credential with an optional `author`; it cannot edit the guide,
  edit history, or delete.

## AI client (MCP)

How an assistant reaches that API.

- An optional MCP client in `mcp/` exposes search and append to AI assistants over
  stdio. It is configured only through environment variables (API URL, token values
  or token-file paths) and contains no installation-specific address or credential.

## Data

Where entries live.

- Diary uses private data storage outside the repository. Entries and the writing
  guide are not committed; only generated sample data may be public.

## Deployment

How the page is exposed.

- A manual NAS deployment may expose Diary on a trusted LAN HTTPS origin; the
  application server itself remains loopback-bound. No CI/CD pipeline is part of the
  deployment.

## Style and vocabulary

How the interface should feel and speak.

- The visual style is simple and playful: thicker outlines, short hover motion, and
  tooltips as speech bubbles that stay inside the viewport. Purple marks the Memory
  spark as something special; yellow stays emphasis, red warns, green marks good.
  Include one small, relevant surprise. The page uses a journal icon.
- Use one name for one thing. The page says “entries” and “dates”, not “notes”,
  “threads”, or “days” where an entry or a calendar date is meant. The browser test
  suite is called “E2E”, never “browser”. Sentences are short.

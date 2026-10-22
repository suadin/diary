# Diary requirements

Diary is a small, local web journal whose primary reader is a future AI session.
The web app, API, documentation, and code are English-only; imported historical
Markdown is preserved as written.

## Entries and writing

- Entries have a calendar date, title, Markdown content, and an author. Multiple
  entries may belong to a date; search matches titles and content only.
- A title names topic and action, joined by an em dash: `Topic — Action`, for example
  `Diary — README reader added`. The topic is a stable word so later tagging can group
  entries; the action says what was done.
- The author is the model name for AI work, for example
  `opencode/deepseek-v4.1-flash-free`, `AI` for imported history, or a human name
  given through the API. It defaults to `AI` and is limited to 80 characters.
- Entry views show date and time side by side, the author, and a button that copies a
  deep link. Entry lists show the date and a coarse `hh24:mi`; entries without a
  same-date timestamp show `12:00`.

## Navigation and deep links

- The page lists dates newest-first in `yyyy-mm-dd` form, seven per page; arrows load
  older or newer windows on demand. A date shows its entries five per page with lazy
  loading, and arrows step to the neighbouring date, including across a page boundary.
- Deep links are first-class: `#/day/2026-10-22`, `#/entry/42`,
  `#/docs/readme/ai-api`, `#/guide`, and `#/search/boot`. Opening one restores the
  same view and the surrounding sidebar window; an unknown link returns to the start.
- Search matches titles and content with dates in the results. Entry previews are
  compact.

## Documentation

- The footer serves the documentation: a book icon opens the README in the main panel.
  The reader also lists the Markdown files under `docs/`, one tab per document and one
  page per level-two heading.
- Sections are navigated by a row of icons, not arrows. Each icon symbolises its
  section, its tooltip gives the section title, and a click opens that page with its
  heading. Long documents reduce the font size instead of widening the page.
- The AI writing guide is separate: editable in the page, five lines tall by default,
  expandable, with a reset to the built-in default.

## Footer and tests

- One compact, centred footer carries README, source, unit tests, and end-to-end
  tests, separated by `|`. It must keep those items on one line at desktop width.
- The unit button shows the latest count and application line coverage and starts the
  suite once. Results are one-shot: once they exist the button shows them and refuses
  another start. It polls every five seconds while a run is active.
- The end-to-end item shows Playwright journeys and `web/app.js` line coverage from
  `test-metrics.e2e.json`. Playwright runs locally, not in the container; a missing
  file shows “not measured”, never zero.
- Coverage is line coverage, not branch coverage. A missing unit report is shown as
  “not measured”, not as zero.

## Human controls

- The local human can edit the AI writing guide and delete entries by date or through
  an inclusive date without signing in. Browser mutations require a same-origin
  loopback request, or the explicitly configured HTTPS origin behind a local reverse
  proxy.
- Delete controls take dates as `yyyy-mm-dd` in plain text fields. Every destructive
  action previews the count and asks for confirmation.
- A round badge shows the total entry count. It stays neutral below 2,000 entries,
  turns amber at 2,000, and red at 5,000, the range where whole-journal requests
  (search, Memory spark) become a risk.

## AI API and MCP

- AI reads the writing guide and searches history over read-only `GET /ai/skill` and
  `GET /ai/search` endpoints. It can append a new entry through a separate
  `POST /ai/entries` credential with an optional `author`; it cannot edit the guide,
  edit history, or delete.
- An optional MCP client in `mcp/` exposes search and append to AI assistants over
  stdio. It is configured only through environment variables (API URL, token values
  or token-file paths) and contains no installation-specific address or credential.

## Data and deployment

- Diary uses private data storage outside the repository and has an appropriate
  journal icon. A manual NAS deployment may expose it on a trusted LAN HTTPS origin;
  the application server itself remains loopback-bound. No CI/CD pipeline is part of
  the deployment.
- Tests cover the API, storage, search, deletion, AI/human mutation boundaries, deep
  links, and legacy Markdown import. README documents local setup, the test commands,
  and operation.

## Style and vocabulary

- The visual style is simple and playful: thicker outlines, short hover motion, and
  tooltips as speech bubbles that stay inside the viewport. Purple marks the Memory
  spark as something special; yellow stays emphasis, red warns, green marks good.
  Include one small, relevant surprise.
- Use one name for one thing. The page says “entries” and “dates”, not “notes”,
  “threads”, or “days” where an entry or a calendar date is meant. Sentences are short.

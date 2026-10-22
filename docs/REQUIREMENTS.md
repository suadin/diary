# Diary requirements

Diary is a small, local web journal whose primary reader is a future AI session.
The web app, API, documentation, and code are English-only; imported historical
Markdown is preserved as written.

- Entries have a calendar date, title, and Markdown content. Multiple entries may
  belong to a day; search matches titles and content only.
- AI reads the writing skill and searches history over read-only `GET /ai/skill` and
  `GET /ai/search` endpoints. It can append a new entry through a separate
  `POST /ai/entries` credential; it cannot edit the skill, edit history, or delete.
- The local human can edit the AI writing skill and delete entries by day or through
  an inclusive date without signing in. Browser mutations require a same-origin
  loopback request, or the explicitly configured HTTPS origin behind a local reverse
  proxy.
- The responsive page lists days newest-first in `YYYY-MM-DD` form, seven per page;
  arrows load older or newer windows on demand. A day shows its entries five per page
  with lazy loading, and arrows step to the neighbouring day. Each date carries a
  coarse `hh.mm`; entries without a same-day timestamp show `12.00`. Search matches
  titles and content with dates in the results. Entry previews are compact.
- A round badge shows the total entry count. It stays neutral below 2,000 entries,
  turns amber at 2,000, and red at 5,000, the range where whole-journal requests
  (search, Memory spark) become a risk.
- The footer serves the README itself: a book icon opens it in the main panel, one
  page per level-two heading, browsable with arrows.
- The page explains the product and its AI-first purpose. It shows the latest test
  count and measured application line coverage as a quiet button that starts the
  suite and polls while it runs. Results are one-shot: once they exist the button
  refuses further runs. The page uses the operating system's light or dark color
  preference and links to the repository.
- Delete controls take dates as `YYYY-MM-DD`. The AI writing guide is five lines
  tall in the default view and can be expanded, keeping the delete controls visible.
- Diary uses private data storage outside the repository and has an appropriate
  journal icon. A manual NAS deployment may expose it on a trusted LAN HTTPS origin;
  the application server itself remains loopback-bound. No CI/CD pipeline is part
  of the deployment.
- An optional MCP client in `mcp/` exposes search and append to AI assistants over
  stdio. It is configured only through environment variables (API URL, token values
  or token-file paths) and defaults to the loopback API; it contains no
  installation-specific address or credential.
- Tests cover the API, storage, search, deletion, AI/human mutation boundaries, and
  legacy Markdown import. README documents local setup and operation.
- The visual style is simple and playful: thicker outlines, short hover motion, and
  tooltips as speech bubbles. Purple marks the Memory spark as something special;
  yellow stays emphasis, red warns, green marks good. Include one small,
  relevant surprise.

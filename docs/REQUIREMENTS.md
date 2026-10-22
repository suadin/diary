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
  arrows load older or newer windows on demand, and a badge shows the total entry
  count for later cleanup. Choosing a day displays its entries, and search matches
  titles and content with dates in the results. Entry previews are compact.
- The page explains the product and its AI-first purpose. It shows the latest test
  count and measured application line coverage as a quiet button that starts the
  suite, polls while it runs, and refuses duplicate starts; it uses the operating
  system's light or dark color preference and links to the repository.
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
- The visual style is simple and playful. Include one small, relevant surprise.

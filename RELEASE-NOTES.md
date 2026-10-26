# Release notes

Newest first. Each version is one page in the reader and one level-two heading here.

## 1.1.0 — Release notes in the reader

- The documentation reader now shows this file as a tab next to README and the SPECS.
  It is read-only and splits into one page per version.
- BASIC SPECS now includes a root `RELEASE-NOTES.md` in the reusable documentation
  reader, so another app can adopt the same pattern.
- Test fixtures use documentation addresses instead of a private LAN address.
- 51 unit tests (76.9 % line coverage) and 27 E2E journeys (71.9 % of `app.js`) pass.
- No database schema change; existing data directories remain compatible.

## 1.0.0 — First public version

- Journal with day windows, entries, title-topic tags, whole-journal view, scoped
  search, and deep links.
- Documentation reader for the README and SPECS, one page per section, with the tests
  for each rule shown below it.
- Append-only AI API with separate read and write tokens, an editable writing guide,
  and an MCP client.
- Container deployment with an HTTPS proxy; the application itself listens only on
  loopback.
- 51 unit tests (76.9 % line coverage) and 27 E2E journeys (71.8 % of `app.js`).

# Release notes

## 1.4.0 — Basic Specs 1.1.0

- Six footer items: README, SPECS, BASIC SPECS, source, unit and E2E.
- The app version opens SPECS; the Basic Specs version opens BASIC SPECS.
- Only a newer Basic Specs major turns red; minor and patch are tooltip-only.
- SPECS begins with one Changelog page; the separate release notes tab is gone.

## 1.3.0 — Basic Specs 1.0.2

- Pinned the public Basic Specs standard in `basics.json`, `basics.lock` and
  `basics/`; the generated `docs/BASIC-SPECS.md` is checked in CI.
- The reader now derives unique section icons and uses the canonical section names.

## 1.2.0 — Shared contract in the footer

- README in the footer opens the reader; it lists README, APP SPECS, BASIC SPECS
  and RELEASE NOTES as tabs.
- The root follows the browser base at `100%`, so Ctrl + wheel zoom scales the
  page and the layout still fits at 80–200 %.
- Unit and E2E icons are a clipboard check and a browser with a play triangle.
  A suite that has not run is red, shows no percentage, and says `not executed`.
  Test tooltips always carry `Measured`, `Duration`, and `Per test` on three rows.
- Cursors distinguish clickable (hand), plain text (default), and tooltip-only
  (`help`); a clickable tooltip keeps the hand.
- 51 unit tests (77.1 % line coverage) and 27 E2E journeys (72.4 % of `app.js`) pass.

## 1.1.1 — Release notes as one page

- Release notes are now the last tab, after README and the SPECS.
- All versions share one continuous page, newest first, without an overview page or a
  section row.
- `BASIC SPECS` describes that shape; existing data directories remain compatible.
- 51 unit tests (77.1 % line coverage) and 27 E2E journeys (72.4 % of `app.js`) pass.

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

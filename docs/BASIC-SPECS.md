# Basic specs

These rules are the reusable base for a small, local web app whose primary reader is
a future AI session. They are not tied to Diary's journal domain, so a later app can
adopt them as they are. Diary's own rules are in [APP SPECS](APP-SPECS.md).

This document lists the rules the app must satisfy: what must be true, not how to run
it. [README](../README.md) explains setup, operation, and deployment.

## Documentation reader

How the README, release notes, and `docs/*.md` are read in the page.

- The footer serves the documentation: a book icon opens the README in the main panel.
  The reader also lists the documentation files under `docs/`, one tab per document and
  one page per level-two heading. An editable guide kept in the data directory has its
  own editor and is not duplicated in the reader.
- A `RELEASE-NOTES.md` at the repository root is the last read-only tab, after the
  SPECS. It is one continuous page: versions stay together, newest first, with no
  overview page and no section row.
- Sections are navigated by a row of icons, not arrows. Each icon symbolises its
  section, its tooltip gives the section title, and a click opens that page with its
  heading. Long pages keep the card width and scroll inside the main panel; the reader
  never widens the page.
- Relative Markdown links between documents open in the reader, whether the link names
  a file in `docs/` or a sibling document. The same links keep working on GitHub, and
  each section has a stable anchor.

## Footer

What the page points to.

- One compact, centred footer carries README, source, unit tests, and E2E tests,
  separated by `|`. Only README is a documentation item: it opens the reader,
  which lists README, APP SPECS, BASIC SPECS and RELEASE NOTES as tabs. Each item
  has its own icon and must stay on one line at desktop width.
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
- Test tooltips always show three rows: `Measured`, `Duration`, `Per test`; a
  missing value is `—`. A test that has not run is red, shows no percentage, and
  its tooltip says `not executed`.

## Navigation and deep links

How a reader reaches a view, and how a link survives a refresh.

- Deep links are first-class: every view has a stable address. Opening one restores
  the same view and the surrounding list or window; an unknown link returns to the
  start.
- A refresh opens the requested view directly. The welcome panel stays hidden until
  the first route has resolved, so it never flashes before content appears.
- Lists page in fixed windows with arrows and lazy loading; the window size is an app
  decision. An open item steps to the newer or older item of the list it came from,
  and Back returns to that list with its search text.
- Search text stays in the address, so a refresh or a shared link shows the same
  filtered list. The result heading names the current scope and adds “(filtered)”
  while search text narrows it.

## Local access

Who may change state, and how the server tells a local browser from a foreign one.

- The local human may change app state without a sign-in. Browser mutations require a
  same-origin loopback request, or the explicitly configured HTTPS origin behind a
  local reverse proxy.
- The same-origin check is not authentication. A server exposed to a LAN or the
  internet needs its own protection.

## Data

Where entries live.

- The app uses private data storage outside the repository. User data and the writing
  guide are not committed; only generated sample data may be public.

## Deployment

How the page is exposed.

- A manual NAS deployment may expose the app on a trusted LAN HTTPS origin; the
  application server itself remains loopback-bound. No CI/CD pipeline is part of the
  deployment.

## Style and vocabulary

How the interface should feel and speak.

- The visual style is simple and playful: thicker outlines, short hover motion, and
  tooltips as speech bubbles that stay inside the viewport. Yellow marks the selection
  and emphasis, red warns, green marks good.
- The root stays at `100%`, so browser zoom (Ctrl + wheel) scales the page and the
  layout still fits at 80–200%; sizes use `rem`, widths use `clamp()`. The header,
  footer, and sidebar stay in place; only the main card scrolls. The sidebar is
  24rem wide, and the card spans the main panel. The header is one row: icon,
  title, catch phrase.
- Cursors: hand for clickable, default for plain text, `help` for a tooltip
  without an action. Tooltip + clickable uses the hand.
- Test tooltips in the footer are wider than other tooltips, so their text fits on fewer
  lines.
- Use one name for one thing. The browser test suite is called “E2E”, never “browser”.
  Sentences are short.

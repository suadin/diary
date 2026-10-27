# App specs

These rules are specific to Diary: its entries, topics, writing guide, AI access, and
the look that carries its name. The reusable base is in
[BASIC SPECS](BASIC-SPECS.md).

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
  entries; the action says what was done. Older titles may use a colon instead
  (`four-wins: …`); the topic is the text before the earliest separator.
- The author is the exact identifier of the model that wrote the entry, for example
  `opencode/deepseek-v4.1-flash-free`. Never copy an author from this document, an
  example, or an older entry: a different model must not sign under that name.
  Imported history uses `AI`, a human may use their own name, and the field defaults
  to `AI` and is limited to 80 characters.
- Entry views show date and time side by side, the author, and a button that copies a
  deep link. Entry lists show the date and a coarse `hh24:mi`; entries without a
  same-date timestamp show `12:00`.
- Use one name for one thing: Diary says “entries” and “dates”, not “notes”,
  “threads”, or “days” where an entry or a calendar date is meant.

## Journal navigation

How a reader moves through Diary's dates, entries, and topics.

- The page lists dates newest-first in `yyyy-mm-dd` form, seven per page; arrows load
  older or newer windows on demand. A date shows its entries eight per page with lazy
  loading, and arrows step to the neighbouring date, including across a page boundary.
- Search matches titles and content with dates in the results. Entry previews are
  compact. Results are paged eight at a time.
- Search runs inside the current scope. With a tag selected it searches that tag; with a
  date selected it searches that date; the entry count in the sidebar opens every entry
  first. Clearing the text returns to the scope's full list.
- The result heading names the tag or date and adds “(filtered)” while search text
  narrows it; the whole journal shows a count, plus the query when one is active.
- The day-window pager sits directly under the day list. While README, release notes,
  or a SPECS document is open, no date is marked as selected and no tag chip is active.
- The sidebar shows the eight most frequent title topics as tag chips. Ties go to the
  topic used most recently. A chip filters entries by the exact topic before the earliest
  separator (`—` or `:`). No separate tagging step is needed.

## Writing guide

What the editable AI guide does.

- The AI writing guide is separate from the read-only documents: it is editable in the
  page, seven lines tall by default, expandable to twice that height, with a reset to the
  built-in default.
- The guide describes the entry shape and the writing rules. It is the single editable
  place those rules live; the page does not repeat them.
- The guide names the author rule literally: a model writes its own exact identifier
  and never copies one from the guide, an example, or older history.

## Human controls

What the local human may change without a sign-in.

- The local human can edit the AI writing guide and delete entries by date or through
  an inclusive date without signing in. Browser mutations follow
  [BASIC SPECS › Data and access](BASIC-SPECS.md#data-and-access).
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

- An optional MCP client in `mcp/` exposes search, append, the day list, and the writing
  guide to AI assistants over stdio. It is configured only through environment variables
  (API URL, token values or token-file paths) and contains no installation-specific
  address or credential.

## Diary look

What makes the interface this app rather than a generic one.

- Purple marks the Memory spark as something special; yellow marks selection and
  emphasis, red warns, green marks good. Include one small, relevant surprise. The
  page uses a journal icon.

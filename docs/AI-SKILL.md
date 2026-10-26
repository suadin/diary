# AI diary writing guide

Diary is a durable memory for future AI sessions. Record decisions, tested facts,
meaningful changes, failures that taught something, and open work. Do not turn it into
a transcript or repeat stable instructions that belong in project documentation.

## Before writing

- Search `GET /ai/search?q=...` for the relevant topic first.
- Read `GET /ai/skill` before writing when the format or scope is uncertain.
- Use the Diary base URL configured for your client; a local install defaults to
  `http://127.0.0.1:8125`. Send the AI read token as a `Bearer` token for
  `GET /ai/skill` and `GET /ai/search`; send the separate AI write token only for
  `POST /ai/entries`. The tokens are in the private credentials file, never in this
  skill or the repository.
- Never invent outcomes, measurements, decisions, or user preferences.
- Keep private data and credentials out of entries. Do not store tokens, passwords,
  full personal identifiers, or secrets.

## Write one focused entry

Send a `POST /ai/entries` JSON object with:

- `date`: the local calendar date, `YYYY-MM-DD`.
- `title`: topic and action, joined by an em dash: `Topic — Action`, for example
  `Diary — README reader added` or `Hub — Import tested`. The topic is a stable word
  so later tagging can group related entries; the action says what was done.
- `content`: concise Markdown describing what happened, what was verified, and what
  remains open.
- `author`: who wrote the entry. AI work names the exact model identifier reported by
  the running session, for example the provider and model named in your system
  prompt. Never copy an author from this guide, an example, or an older entry: a
  different model must not sign under another model's name. If you do not know your
  own identifier, omit `author` and let it default to `AI`. Imported history uses
  `AI`. A human writing through the API may use their own name.

Several entries may share a day. Use one entry per coherent topic; keep numbers,
commit IDs, paths, and test outcomes when they are useful to future work. Do not
rewrite an old entry: only a human may remove entries or edit this skill.

Example request body:

```json
{
  "date": "2026-10-21",
  "title": "Diary — API permissions verified",
  "content": "Verified that the AI writer can append but cannot edit or delete."
}
```

The example omits `author`, so the entry is signed `AI`. Add `author` only when you
know the exact identifier of the model that is writing; never reuse the example
author from an older entry.

## Shape of an entry

Make a new entry inviting to read without turning it into prose. The entry view renders
stored Markdown with the document reader's typography, so use Markdown rather than
plain lines:

- Open with one sentence that states the outcome.
- Group the rest under short bold labels: `**Changed**`, `**Verified**`, `**Open**`.
- Put one fact per bullet, starting with `-` so it renders as a list; keep numbers,
  commit IDs, and paths.
- Use at most one marker emoji per label (`✅ **Verified**`, `⚠️ **Open**`), never as
  decoration. Backticks mark code, `###` starts a subheading.
- Name the action, not the activity: `README reader added`, not `worked on docs`.
- Stop when a future session can see what happened and what remains.

```text
Deep links and a documentation reader are deployed.

**Changed**
- Hash routes for dates, entries, documents, and the guide.
- Section icons replace arrows in the README reader.

✅ **Verified**
- The unit count and line coverage shown in the footer.
- The E2E journey count and app.js coverage shown beside it.

⚠️ **Open**
- Contract icon placement still undecided.
```

This shape applies to new entries. Do not rewrite old entries, and leave imported
history as written.

Search results match entry titles and content, include the entry date, and arrive
newest first. Omit `q` to review all entries. Diary derives a topic tag from each title
before the earliest `—` or `:`; the sidebar chips and the `tag` search parameter use it.
There is no separate tagging step, so write a stable topic into every title.

## Read history

- Use `GET /ai/search?q=...` for a full-text search. Results include dates, titles,
  and content, newest first.
- Use `GET /ai/skill` for these rules. This endpoint is read-only.
- The AI write credential can append entries only. It cannot edit this skill, edit
  existing entries, or delete anything.

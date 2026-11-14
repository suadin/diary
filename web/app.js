const elements = {
  dayList: document.getElementById("day-list"),
  dayCount: document.getElementById("day-count"),
  dayRange: document.getElementById("day-range"),
  daysNewer: document.getElementById("days-newer"),
  daysOlder: document.getElementById("days-older"),
  searchInput: document.getElementById("search-input"),
  clearSearch: document.getElementById("clear-search"),
  welcome: document.getElementById("welcome"),
  selection: document.getElementById("selection"),
  selectedDate: document.getElementById("selected-date"),
  dayNewer: document.getElementById("day-newer"),
  dayOlder: document.getElementById("day-older"),
  entryList: document.getElementById("entry-list"),
  entryPager: document.getElementById("entry-pager"),
  entryRange: document.getElementById("entry-range"),
  entriesNewer: document.getElementById("entries-newer"),
  entriesOlder: document.getElementById("entries-older"),
  searchResults: document.getElementById("search-results"),
  searchTitle: document.getElementById("search-title"),
  resultList: document.getElementById("result-list"),
  entryView: document.getElementById("entry-view"),
  tagFilter: document.getElementById("tag-filter"),
  tagChips: document.getElementById("tag-chips"),
  mainPanel: document.getElementById("main-panel"),
  resultPager: document.getElementById("result-pager"),
  resultRange: document.getElementById("result-range"),
  resultsNewer: document.getElementById("results-newer"),
  resultsOlder: document.getElementById("results-older"),
  sparkButton: document.getElementById("spark-button"),
  guideButton: document.getElementById("guide-button"),
  editor: document.getElementById("editor"),
  backToJournal: document.getElementById("back-to-journal"),
  skillEditor: document.getElementById("skill-editor"),
  guideToggle: document.getElementById("guide-toggle"),
  guideReset: document.getElementById("guide-reset"),
  saveSkill: document.getElementById("save-skill"),
  saveStatus: document.getElementById("save-status"),
  deleteDay: document.getElementById("delete-day"),
  deleteDayButton: document.getElementById("delete-day-button"),
  deleteBefore: document.getElementById("delete-before"),
  deleteBeforeButton: document.getElementById("delete-before-button"),
  deleteStatus: document.getElementById("delete-status"),
  readmeButton: document.getElementById("readme-button"),
  toast: document.getElementById("toast"),
};

const PAGE_SIZE = 7;
const ENTRY_PAGE_SIZE = 8;
const RESULT_PAGE_SIZE = 8;
const TEST_POLL_MS = 5000;
const ENTRY_WARN = 2000;
const ENTRY_CRITICAL = 5000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DOC_SPECS = new Set(["basic-specs", "app-specs"]);

function queryPart(query) {
  return query ? `?q=${encodeURIComponent(query)}` : "";
}


const ROUTE = {
  welcome: "#/",
  day: (date, query = "") => `#/day/${date}${queryPart(query)}`,
  entry: (id) => `#/entry/${id}`,
  docs: (doc, section) => (section ? `#/docs/${doc}/${section}` : `#/docs/${doc}`),
  guide: "#/guide",
  tag: (tag, query = "") => `#/tag/${encodeURIComponent(tag)}${queryPart(query)}`,
  all: (query = "") => `#/all${queryPart(query)}`,
};

function parseRoute() {
  const [path, search = ""] = window.location.hash.replace(/^#\/?/, "").split("?");
  let parts = [];
  try {
    parts = path.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  } catch (error) {
    return { parts: [], query: "" };
  }
  return { parts, query: (new URLSearchParams(search).get("q") || "").trim() };
}

const state = {
  days: [],
  pageOffset: 0,
  pageSize: PAGE_SIZE,
  totalDays: 0,
  totalEntries: 0,
  latestDate: null,
  pages: new Map(),
  selectedDate: null,
  entryOffset: 0,
  entryTotal: 0,
  entryPages: new Map(),
  searchTimer: null,
  testTimer: null,
  docs: null,
  metrics: null,
  runtime: null,
  latest: null,
  tags: [],
  activeTag: null,
  globalSearch: false,
  inDocs: false,
  returnHash: null,
  pendingEntryContext: null,
  entryContext: null,
  resultOffset: 0,
  resultTotal: 0,
  resultTicket: 0,
  routeTicket: 0,
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || response.statusText);
  }
  return response.headers.get("Content-Type")?.includes("application/json") ? response.json() : response.text();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.remove("visible"), 3200);
}

function showOnly(section) {
  for (const item of [elements.welcome, elements.selection, elements.searchResults, elements.entryView, elements.editor]) {
    item.hidden = item !== section;
  }
  elements.mainPanel.scrollTop = 0;
}

function renderDays() {
  const total = state.totalEntries;
  elements.dayCount.textContent = String(total);
  elements.dayCount.classList.toggle("warn", total >= ENTRY_WARN && total < ENTRY_CRITICAL);
  elements.dayCount.classList.toggle("critical", total >= ENTRY_CRITICAL);
  const health = total >= ENTRY_CRITICAL
    ? "heavy; search and spark load the whole journal"
    : total >= ENTRY_WARN
      ? "growing; search and spark load the whole journal"
      : "comfortable";
  elements.dayCount.dataset.tip = `${total} ${total === 1 ? "entry" : "entries"} in ${state.totalDays} ${state.totalDays === 1 ? "date" : "dates"} — ${health}`;
  elements.dayList.replaceChildren();
  for (const day of state.days) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-button${!state.activeTag && !state.globalSearch && !state.inDocs && state.selectedDate === day.date ? " active" : ""}`;
    const date = document.createElement("span");
    date.textContent = day.date;
    const count = document.createElement("span");
    count.textContent = `${day.count} ${day.count === 1 ? "entry" : "entries"}`;
    button.append(date, count);
    button.addEventListener("click", () => navigate(ROUTE.day(day.date)).catch((error) => showToast(error.message)));
    elements.dayList.append(button);
  }
  const first = state.totalDays ? state.pageOffset + 1 : 0;
  const last = state.pageOffset + state.days.length;
  elements.dayRange.textContent = state.totalDays ? `${first}–${last} / ${state.totalDays}` : "";
  elements.daysNewer.disabled = state.pageOffset <= 0;
  elements.daysOlder.disabled = last >= state.totalDays;
}

function renderTags() {
  elements.tagFilter.hidden = !state.tags.length;
  elements.tagChips.replaceChildren();
  for (const item of state.tags) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `tag-chip${state.activeTag === item.tag ? " active" : ""}`;
    chip.setAttribute("aria-pressed", String(state.activeTag === item.tag));
    chip.dataset.tag = item.tag;
    chip.append(document.createTextNode(item.tag));
    const count = document.createElement("span");
    count.className = "tag-count";
    count.textContent = String(item.count);
    chip.append(count);
    chip.addEventListener("click", () => toggleTag(item.tag).catch((error) => showToast(error.message)));
    elements.tagChips.append(chip);
  }
}

async function loadTags() {
  try {
    state.tags = await request("/api/tags");
  } catch (error) {
    state.tags = [];
  }
  renderTags();
}

async function toggleTag(tag) {
  if (state.activeTag === tag) {
    state.activeTag = null;
    elements.searchInput.value = "";
    renderTags();
    if (state.selectedDate) {
      await selectDay(state.selectedDate);
      history.replaceState({}, "", ROUTE.day(state.selectedDate));
    } else {
      showOnly(elements.welcome);
      history.replaceState({}, "", ROUTE.welcome);
    }
    return;
  }
  await navigate(ROUTE.tag(tag));
}

function entryTime(entry) {
  const created = entry.createdAt ? new Date(entry.createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) return "12:00";
  const localDay = [
    created.getFullYear(),
    String(created.getMonth() + 1).padStart(2, "0"),
    String(created.getDate()).padStart(2, "0"),
  ].join("-");
  if (localDay !== entry.date) return "12:00";
  return `${String(created.getHours()).padStart(2, "0")}:${String(created.getMinutes()).padStart(2, "0")}`;
}

function dateLabel(entry) {
  const label = document.createElement("span");
  label.className = "date-label";
  const day = document.createElement("span");
  day.className = "date-day";
  day.textContent = entry.date;
  const time = document.createElement("span");
  time.className = "date-time";
  time.textContent = entryTime(entry);
  label.append(day, time);
  return label;
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderEntryCards(entries, container) {
  container.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No entries here yet. The quiet is part of the story.";
    container.append(empty);
    return;
  }
  for (const entry of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = container === elements.resultList ? "result-card" : "entry-card";
    const title = document.createElement("h3");
    title.textContent = entry.title;
    const preview = document.createElement("p");
    preview.textContent = plainText(entry.content).slice(0, 84);
    button.append(dateLabel(entry), title, preview);
    button.addEventListener("click", () => openFromList(entry.id));
    container.append(button);
  }
}

function openFromList(id) {
  state.returnHash = window.location.hash;
  state.pendingEntryContext = { ...resultScope(), query: elements.searchInput.value.trim() };
  navigate(ROUTE.entry(id)).catch((error) => showToast(error.message));
}

function renderEntryPager() {
  elements.entryPager.hidden = state.entryTotal <= ENTRY_PAGE_SIZE;
  if (elements.entryPager.hidden) return;
  const first = state.entryOffset + 1;
  const last = Math.min(state.entryOffset + ENTRY_PAGE_SIZE, state.entryTotal);
  elements.entryRange.textContent = `${first}–${last} / ${state.entryTotal}`;
  elements.entriesNewer.disabled = state.entryOffset <= 0;
  elements.entriesOlder.disabled = last >= state.entryTotal;
}

function animateSelection(direction) {
  const node = elements.selection;
  node.classList.remove("slide-newer", "slide-older");
  void node.offsetWidth;
  node.classList.add(direction < 0 ? "slide-newer" : "slide-older");
  window.setTimeout(() => node.classList.remove("slide-newer", "slide-older"), 320);
}

async function selectDay(day, direction = 0) {
  state.selectedDate = day;
  state.entryOffset = 0;
  state.entryPages.clear();
  elements.selectedDate.textContent = day;
  renderDays();
  await loadEntryPage(0);
  showOnly(elements.selection);
  if (direction) animateSelection(direction);
}

async function loadEntryPage(offset) {
  if (!state.selectedDate) return;
  const key = `${state.selectedDate}:${offset}`;
  let page = state.entryPages.get(key);
  if (!page) {
    page = await request(`/api/entries/page?${new URLSearchParams({
      date: state.selectedDate,
      offset: String(offset),
      limit: String(ENTRY_PAGE_SIZE),
    })}`);
    state.entryPages.set(key, page);
  }
  if (!page.entries.length && page.total > 0 && offset > 0) {
    const lastOffset = Math.max(0, Math.floor((page.total - 1) / ENTRY_PAGE_SIZE) * ENTRY_PAGE_SIZE);
    if (lastOffset !== offset) return loadEntryPage(lastOffset);
  }
  state.entryOffset = page.offset;
  state.entryTotal = page.total;
  renderEntryCards(page.entries, elements.entryList);
  renderEntryPager();
}

async function ensureDayWindow(date) {
  if (state.days.some((day) => day.date === date)) return true;
  await loadDayPage(0);
  if (state.days.some((day) => day.date === date)) return true;
  const days = await request("/api/days");
  const index = days.findIndex((day) => day.date === date);
  if (index === -1) return false;
  const offset = Math.floor(index / state.pageSize) * state.pageSize;
  await loadDayPage(offset);
  return state.days.some((day) => day.date === date);
}

async function adjacentDay(direction) {
  const index = state.days.findIndex((day) => day.date === state.selectedDate);
  if (index === -1) return false;
  let target = state.days[index + direction];
  if (!target) {
    if (direction > 0) {
      const next = state.pageOffset + state.pageSize;
      if (next >= state.totalDays) {
        showToast("This is the oldest date.");
        return false;
      }
      await loadDayPage(next);
      target = state.days[0];
    } else {
      const previous = state.pageOffset - state.pageSize;
      if (previous < 0) {
        showToast("This is the newest date.");
        return false;
      }
      await loadDayPage(previous);
      target = state.days[state.days.length - 1];
    }
  }
  if (!target) return false;
  await navigate(ROUTE.day(target.date));
  return true;
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("Link copied.");
  } catch (error) {
    showToast("Copying needs a secure connection.");
  }
}

async function neighbours(entry, context) {
  const params = new URLSearchParams();
  if (context.query) params.set("q", context.query);
  if (context.tag) params.set("tag", context.tag);
  if (context.date) params.set("date", context.date);
  const list = await request(`/api/search?${params}`);
  const index = list.findIndex((item) => item.id === entry.id);
  return {
    newer: index > 0 ? list[index - 1] : null,
    older: index >= 0 && index < list.length - 1 ? list[index + 1] : null,
  };
}

function stepButton(label, target, tip) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "link-button has-tip";
  button.textContent = label;
  button.dataset.tip = tip;
  button.disabled = !target;
  if (target) {
    button.addEventListener("click", () => {
      state.pendingEntryContext = state.entryContext;
      navigate(ROUTE.entry(target.id)).catch((error) => showToast(error.message));
    });
  }
  return button;
}

function openEntry(entry, steps = { newer: null, older: null }) {
  showOnly(elements.entryView);
  elements.entryView.replaceChildren();
  const meta = document.createElement("div");
  meta.className = "entry-meta";
  const left = document.createElement("div");
  left.className = "entry-meta-left";
  const when = document.createElement("span");
  when.className = "entry-when";
  const day = document.createElement("span");
  day.className = "date-day";
  day.textContent = entry.date;
  const time = document.createElement("span");
  time.className = "date-time";
  time.textContent = entryTime(entry);
  when.append(day, time);
  const author = document.createElement("span");
  author.className = "entry-author";
  author.textContent = `by ${entry.author || "AI"}`;
  left.append(when, author);
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "link-button has-tip";
  copy.textContent = "Copy link";
  copy.dataset.tip = "Copy a deep link to this entry";
  copy.addEventListener("click", copyLink);
  const back = document.createElement("button");
  back.type = "button";
  back.className = "back-button";
  back.textContent = "← Back";
  back.addEventListener("click", () => navigate(state.returnHash || ROUTE.day(entry.date)).catch((error) => showToast(error.message)));
  const step = document.createElement("div");
  step.className = "entry-step";
  step.append(
    stepButton("‹ Newer", steps.newer, "Previous entry in this list"),
    stepButton("Older ›", steps.older, "Next entry in this list"),
  );
  meta.append(left, copy, step, back);
  const title = document.createElement("h2");
  title.textContent = entry.title;
  const content = document.createElement("div");
  content.className = "entry-content";
  content.innerHTML = renderMarkdown(entry.content);
  elements.entryView.append(meta, title, content);
}

function resultScope() {
  if (state.activeTag) return { tag: state.activeTag, date: null };
  if (state.globalSearch || !state.selectedDate) return { tag: null, date: null };
  return { tag: null, date: state.selectedDate };
}

function resultTitle(total, tag, date, query) {
  if (tag) return query ? `${tag} (filtered)` : tag;
  if (date) return query ? `${date} (filtered)` : date;
  const noun = total === 1 ? "entry" : "entries";
  return query ? `${total} ${noun} matching “${query}”` : `${total} ${noun}`;
}

function renderResultPager() {
  elements.resultPager.hidden = state.resultTotal <= RESULT_PAGE_SIZE;
  if (elements.resultPager.hidden) return;
  const first = state.resultOffset + 1;
  const last = Math.min(state.resultOffset + RESULT_PAGE_SIZE, state.resultTotal);
  elements.resultRange.textContent = `${first}–${last} / ${state.resultTotal}`;
  elements.resultsNewer.disabled = state.resultOffset <= 0;
  elements.resultsOlder.disabled = last >= state.resultTotal;
}

// One result list for every scope: a tag, a selected date, the whole journal,
// or any of them narrowed by the search text. Pages are RESULT_PAGE_SIZE long.
async function showResults(offset = 0) {
  const query = elements.searchInput.value.trim();
  const { tag, date } = resultScope();
  const ticket = ++state.resultTicket;
  const params = new URLSearchParams({ q: query, offset: String(offset), limit: String(RESULT_PAGE_SIZE) });
  if (tag) params.set("tag", tag);
  if (date) params.set("date", date);
  let page = await request(`/api/search/page?${params}`);
  if (ticket !== state.resultTicket) return;
  if (!page.entries.length && page.total > 0 && offset > 0) {
    const lastOffset = Math.max(0, Math.floor((page.total - 1) / RESULT_PAGE_SIZE) * RESULT_PAGE_SIZE);
    if (lastOffset !== offset) return showResults(lastOffset);
  }
  state.resultOffset = page.offset;
  state.resultTotal = page.total;
  elements.searchTitle.textContent = resultTitle(page.total, tag, date, query);
  renderEntryCards(page.entries, elements.resultList);
  renderResultPager();
  showOnly(elements.searchResults);
}

// The address always shows the current scope and search text, so a refresh or a shared link restores the same list.
function syncRoute() {
  const query = elements.searchInput.value.trim();
  const { tag, date } = resultScope();
  let hash = ROUTE.welcome;
  if (tag) hash = ROUTE.tag(tag, query);
  else if (date) hash = ROUTE.day(date, query);
  else if (state.globalSearch) hash = ROUTE.all(query);
  if (window.location.hash !== hash) history.replaceState({}, "", hash);
}

async function search() {
  const query = elements.searchInput.value.trim();
  const scope = resultScope();
  renderDays();
  renderTags();
  syncRoute();
  if (!query && !scope.tag && !scope.date && !state.globalSearch) {
    showOnly(state.selectedDate ? elements.selection : elements.welcome);
    return;
  }
  if (!query && !scope.tag && scope.date) {
    showOnly(elements.selection);
    return;
  }
  await showResults(0);
}


async function loadDayPage(offset) {
  const lastOffset = Math.max(0, Math.floor((state.totalDays - 1) / state.pageSize) * state.pageSize);
  const wanted = Math.max(0, Math.min(offset, lastOffset));
  const page = state.pages.get(wanted) || await request(`/api/days/page?offset=${wanted}&limit=${state.pageSize}`);
  state.pages.set(wanted, page);
  state.pageOffset = page.offset;
  state.totalDays = page.totalDays;
  state.totalEntries = page.totalEntries;
  state.days = page.days;
  if (page.offset === 0) state.latestDate = page.days[0]?.date || null;
  renderDays();
}

function setGuideExpanded(expanded) {
  elements.skillEditor.classList.toggle("expanded", expanded);
  elements.guideToggle.setAttribute("aria-expanded", String(expanded));
  elements.guideToggle.textContent = expanded ? "Compact" : "Show all";
}

async function openEditor() {
  const skill = await request("/api/skill");
  elements.skillEditor.value = skill;
  setGuideExpanded(false);
  elements.saveStatus.textContent = "";
  showOnly(elements.editor);
}

function isoDay(input) {
  const value = input.value.trim();
  if (!value) return null;
  if (!ISO_DAY.test(value)) {
    elements.deleteStatus.textContent = "Use yyyy-mm-dd, for example 2026-10-22.";
    return null;
  }
  return value;
}

async function deleteBy(filter, label) {
  try {
    const previewUrl = filter.date
      ? `/api/entries?date=${encodeURIComponent(filter.date)}`
      : "/api/search?q=";
    const preview = await request(previewUrl);
    const count = filter.before
      ? preview.filter((entry) => entry.date <= filter.before).length
      : preview.length;
    if (!count) {
      elements.deleteStatus.textContent = `No entries match ${label}.`;
      return;
    }
    if (!window.confirm(`Delete ${count} ${count === 1 ? "entry" : "entries"}: ${label}? This cannot be undone.`)) return;
    const result = await request("/api/entries", { method: "DELETE", body: JSON.stringify(filter) });
    elements.deleteStatus.textContent = `${result.deleted} ${result.deleted === 1 ? "entry" : "entries"} deleted.`;
    state.pages.clear();
    state.entryPages.clear();
    state.selectedDate = null;
    state.activeTag = null;
    await loadDayPage(0);
    await loadTags();
    if (state.days.length) {
      await selectDay(state.days[0].date);
      history.replaceState({}, "", ROUTE.day(state.days[0].date));
    } else {
      history.replaceState({}, "", ROUTE.welcome);
      showOnly(elements.welcome);
    }
  } catch (error) {
    elements.deleteStatus.textContent = error.message;
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(text) {
  const codes = [];
  let output = escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(
    /\[([^\]]+)\]\(((?:\.\.\/)?(?:docs\/)?[A-Za-z0-9._-]+\.md)(#[A-Za-z0-9-]+)?\)/g,
    (_, label, path, anchor) => {
      const file = path.split("/").pop();
      const slug = file.toLowerCase() === "readme.md"
        ? "readme"
        : file.replace(/\.md$/i, "").toLowerCase();
      const section = anchor ? anchor.slice(1) : "overview";
      return `<a href="${path}${anchor || ""}" data-doc-link="${slug}#${section}">${label}</a>`;
    },
  );
  output = output.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  output = output.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  output = output.replace(/&lt;(https?:\/\/[^\s]+?)&gt;/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  return output.replace(/\u0000(\d+)\u0000/g, (_, index) => `<code>${codes[Number(index)]}</code>`);
}

function renderMarkdown(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let fence = null;
  let list = null;
  let listItem = -1;
  let paragraph = [];
  let table = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
    listItem = -1;
  };
  const closeTable = () => {
    if (!table) return;
    const rows = table
      .filter((row) => !/^\|?[\s:|-]+\|?$/.test(row))
      .map((row) => row.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
    if (rows.length) {
      const [head, ...body] = rows;
      html.push(`<table><thead><tr>${head.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>`);
      for (const row of body) {
        html.push(`<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`);
      }
      html.push("</tbody></table>");
    }
    table = null;
  };
  const closeBlocks = () => {
    flushParagraph();
    closeList();
    closeTable();
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (fence === null) {
        closeBlocks();
        fence = [];
      } else {
        html.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      fence.push(line);
      continue;
    }
    if (!line.trim()) {
      closeBlocks();
      continue;
    }
    if (line.trimStart().startsWith("|")) {
      flushParagraph();
      closeList();
      table = table || [];
      table.push(line.trim());
      continue;
    }
    closeTable();
    if (list && /^\s{2,}\S/.test(line)) {
      html[listItem] = html[listItem].replace(
        /<\/li>$/,
        ` ${inlineMarkdown(line.trim())}</li>`,
      );
      continue;
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      closeBlocks();
      html.push(`<h4>${inlineMarkdown(heading[1])}</h4>`);
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (list !== "ul") {
        closeList();
        html.push("<ul>");
        list = "ul";
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      listItem = html.length - 1;
      continue;
    }
    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ordered) {
      flushParagraph();
      if (list !== "ol") {
        closeList();
        html.push("<ol>");
        list = "ol";
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      listItem = html.length - 1;
      continue;
    }
    closeList();
    paragraph.push(line.trim());
  }
  if (fence !== null) html.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
  closeBlocks();
  return html.join("");
}




async function showDayRoute(date, query = "") {
  if (!ISO_DAY.test(date) || !(await ensureDayWindow(date))) {
    showToast(`${date} has no entries.`);
    state.selectedDate = null;
    state.entryOffset = 0;
    state.entryTotal = 0;
    state.entryPages.clear();
    renderDays();
    showOnly(elements.welcome);
    history.replaceState({}, "", ROUTE.welcome);
    return;
  }
  await selectDay(date);
  elements.searchInput.value = query;
  if (query) await showResults(0);
  if (window.location.hash !== ROUTE.day(date, query)) history.replaceState({}, "", ROUTE.day(date, query));
}

async function showEntryRoute(id) {
  let entry;
  try {
    entry = await request(`/api/entry?id=${encodeURIComponent(id)}`);
  } catch (error) {
    showToast("That entry is not here anymore.");
    state.selectedDate = null;
    state.entryOffset = 0;
    state.entryTotal = 0;
    state.entryPages.clear();
    renderDays();
    showOnly(elements.welcome);
    history.replaceState({}, "", ROUTE.welcome);
    return;
  }
  const pending = state.pendingEntryContext;
  state.pendingEntryContext = null;
  if (!pending) state.returnHash = ROUTE.day(entry.date);
  state.entryContext = pending || { tag: null, date: entry.date, query: "" };
  await ensureDayWindow(entry.date);
  await selectDay(entry.date);
  const steps = await neighbours(entry, state.entryContext);
  openEntry(entry, steps);
}

async function showTagRoute(tag, query = "") {
  state.activeTag = tag;
  elements.searchInput.value = query;
  renderDays();
  renderTags();
  await showResults(0);
  if (window.location.hash !== ROUTE.tag(tag, query)) history.replaceState({}, "", ROUTE.tag(tag, query));
}


async function applyRoute() {
  const ticket = ++state.routeTicket;
  const { parts, query } = parseRoute();
  const [kind, first, second] = parts;
  if (kind !== "tag") state.activeTag = null;
  if (kind !== "all" && kind !== "search") state.globalSearch = false;
  state.inDocs = kind === "docs";
  renderDays();
  renderTags();
  if (kind === "docs") {
    elements.searchInput.value = "";
    showOnly(null);
    norm?.open(first || "readme", second || null);
    return;
  }
  norm?.close();
  if (kind === "day" && first) {
    await showDayRoute(first, query);
    return;
  }
  if (kind === "entry" && first) {
    elements.searchInput.value = "";
    await showEntryRoute(first);
    return;
  }
  if (kind === "tag" && first) {
    await showTagRoute(first, query);
    return;
  }
  if (kind === "guide") {
    elements.searchInput.value = "";
    await openEditor();
    return;
  }
  if (kind === "all" || (kind === "search" && first)) {
    state.globalSearch = true;
    elements.searchInput.value = kind === "all" ? query : first;
    await showResults(0);
    if (kind === "search") history.replaceState({}, "", ROUTE.all(first));
    return;
  }
  if (ticket !== state.routeTicket) return;
  elements.searchInput.value = "";
  showOnly(elements.welcome);
  if (window.location.hash !== ROUTE.welcome) history.replaceState({}, "", ROUTE.welcome);
}

async function navigate(hash, { replace = false } = {}) {
  if (window.location.hash === hash) {
    await applyRoute();
    return;
  }
  if (replace) history.replaceState({}, "", hash);
  else history.pushState({}, "", hash);
  await applyRoute();
}


elements.daysNewer.addEventListener("click", () => loadDayPage(state.pageOffset - state.pageSize).catch((error) => showToast(error.message)));
elements.daysOlder.addEventListener("click", () => loadDayPage(state.pageOffset + state.pageSize).catch((error) => showToast(error.message)));
elements.dayNewer.addEventListener("click", () => adjacentDay(-1).then((moved) => {
  if (moved) animateSelection(-1);
}).catch((error) => showToast(error.message)));
elements.dayOlder.addEventListener("click", () => adjacentDay(1).then((moved) => {
  if (moved) animateSelection(1);
}).catch((error) => showToast(error.message)));
elements.entriesNewer.addEventListener("click", () => loadEntryPage(state.entryOffset - ENTRY_PAGE_SIZE).catch((error) => showToast(error.message)));
elements.entriesOlder.addEventListener("click", () => loadEntryPage(state.entryOffset + ENTRY_PAGE_SIZE).catch((error) => showToast(error.message)));
elements.resultsNewer.addEventListener("click", () => showResults(state.resultOffset - RESULT_PAGE_SIZE).catch((error) => showToast(error.message)));
elements.resultsOlder.addEventListener("click", () => showResults(state.resultOffset + RESULT_PAGE_SIZE).catch((error) => showToast(error.message)));
elements.dayCount.addEventListener("click", () => navigate(ROUTE.all()).catch((error) => showToast(error.message)));
elements.searchInput.addEventListener("input", () => {
  window.clearTimeout(state.searchTimer);
  state.searchTimer = window.setTimeout(() => search().catch((error) => showToast(error.message)), 180);
});
elements.clearSearch.addEventListener("click", () => {
  elements.searchInput.value = "";
  search().catch((error) => showToast(error.message));
});
elements.guideButton.addEventListener("click", () => navigate(ROUTE.guide).catch((error) => showToast(error.message)));
elements.backToJournal.addEventListener("click", () => navigate(state.selectedDate ? ROUTE.day(state.selectedDate) : ROUTE.welcome).catch((error) => showToast(error.message)));
elements.guideToggle.addEventListener("click", () => {
  setGuideExpanded(elements.guideToggle.getAttribute("aria-expanded") !== "true");
});
elements.guideReset.addEventListener("click", async () => {
  if (!window.confirm("Reset the writing guide to the built-in default?")) return;
  elements.saveStatus.textContent = "";
  try {
    const result = await request("/api/skill/reset", { method: "POST" });
    elements.skillEditor.value = result.content;
    setGuideExpanded(false);
    elements.saveStatus.textContent = "Guide reset to the default.";
  } catch (error) {
    elements.saveStatus.textContent = error.message;
  }
});
elements.saveSkill.addEventListener("click", async () => {
  elements.saveStatus.textContent = "";
  try {
    await request("/api/skill", { method: "PUT", body: JSON.stringify({ content: elements.skillEditor.value }) });
    elements.saveStatus.textContent = "Guide saved. The next session will read this version.";
  } catch (error) { elements.saveStatus.textContent = error.message; }
});
elements.deleteDayButton.addEventListener("click", () => {
  const day = isoDay(elements.deleteDay);
  if (day) deleteBy({ date: day }, `all entries for ${day}`);
});
elements.deleteBeforeButton.addEventListener("click", () => {
  const day = isoDay(elements.deleteBefore);
  if (day) deleteBy({ before: day }, `all entries through ${day}`);
});
elements.sparkButton.addEventListener("click", async () => {
  try {
    const entries = await request("/api/search?q=");
    const older = entries.filter((entry) => entry.date !== state.latestDate);
    if (!older.length) { showToast("A spark needs a little more history to travel through."); return; }
    const memory = older[Math.floor(Math.random() * older.length)];
    await navigate(ROUTE.entry(memory.id));
    elements.entryView.classList.remove("spark");
    void elements.entryView.offsetWidth;
    elements.entryView.classList.add("spark");
    showToast(`A little echo from ${memory.date}`);
  } catch (error) {
    showToast(error.message);
  }
});

function followDocLink(event) {
  const link = event.target.closest?.("a[data-doc-link]");
  if (!link) return;
  event.preventDefault();
  const [slug, section] = link.dataset.docLink.split("#");
  navigate(ROUTE.docs(slug, section || "overview")).catch((error) => showToast(error.message));
}

elements.entryView.addEventListener("click", followDocLink);

window.addEventListener("popstate", () => { applyRoute().catch((error) => showToast(error.message)); });
window.addEventListener("hashchange", () => { applyRoute().catch((error) => showToast(error.message)); });

let norm = null;

async function init() {
  await loadDayPage(0);
  await loadTags();

  try {
    const { mountNorm } = await import("./norm/norm.js");
    const response = await fetch("norm/app.json");
    const runtime = response.ok ? await response.json() : null;
    norm = await mountNorm({
      app: { name: "diary", version: runtime?.appVersion ?? "1.4.0", logo: "diary.svg" },
      source: "https://github.com/suadin/diary",
      normVersion: runtime?.norm ?? "2.0.0",
      docs: async () => (await request("/api/docs")).documents,
      metrics: "/api/metrics",
      autoRoute: false,
      homeHash: () => (state.selectedDate ? ROUTE.day(state.selectedDate) : ROUTE.welcome),
    });
  } catch (error) {
    showToast(error.message);
  }

  const hash = window.location.hash;
  if (hash && hash !== "#/" && hash !== "#") {
    await applyRoute();
    return;
  }
  if (state.days.length) {
    await selectDay(state.days[0].date);
    history.replaceState({}, "", ROUTE.day(state.days[0].date));
  } else {
    showOnly(elements.welcome);
  }
}

init().catch((error) => {
  showToast(error.message);
  showOnly(elements.welcome);
});

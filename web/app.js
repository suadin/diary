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
  runTests: document.getElementById("run-tests"),
  unitMetrics: document.getElementById("unit-metrics"),
  e2eMetrics: document.getElementById("e2e-metrics"),
  e2eMetricsLabel: document.getElementById("e2e-metrics-label"),
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
  docsView: document.getElementById("docs-view"),
  docsTitle: document.getElementById("docs-title"),
  docsBack: document.getElementById("docs-back"),
  docTabs: document.getElementById("doc-tabs"),
  docSections: document.getElementById("doc-sections"),
  docSectionTitle: document.getElementById("doc-section-title"),
  docBody: document.getElementById("doc-body"),
  tooltip: document.getElementById("tooltip"),
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
  const parts = path.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  return { parts, query: (new URLSearchParams(search).get("q") || "").trim() };
}

const ICONS = {
  overview: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5Z"/>',
  what: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  install: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m7.5 10 2.5 2-2.5 2M12.5 14h4"/>',
  package: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  pencil: '<path d="M6 3.5h8l4 4V14"/><path d="M14 3.5v4h4"/><path d="M6 3.5v17h5"/><path d="M8.5 20.5h3l8-8a2 2 0 0 0-3-3l-8 8v3Z"/><path d="M15.5 10.5l3 3"/>',
  link: '<path d="M10 13.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L11.5 7"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0L6.5 13a3.5 3.5 0 0 0 5 5l1-1"/>',
  foot: '<path d="M8.5 13.5c2.4-.9 5.8-.5 7.7.9 1.2.9 1.8 2.2 1.6 3.4-.2 1.2-1.1 1.9-2.5 1.9-2.4 0-4.2-.8-5.8-1.7-1.4-.8-2.4-1.1-3.3-1.4-.9-.3-1-1.2-.3-1.9.8-.8 1.6-1 2.6-1.2Z"/><circle cx="8.4" cy="7.6" r="1.6"/><circle cx="11.8" cy="5.8" r="1.3"/><circle cx="14.6" cy="8" r="1.2"/><circle cx="15.4" cy="11.2" r="1.1"/>',
  guide: '<path d="M12 6.5C10 4.8 7.2 4.5 4 5v13c3.2-.5 6-.2 8 1.5 2-1.7 4.8-2 8-1.5V5c-3.2-.5-6-.2-8 1.5Z"/><path d="M12 6.5v13"/>',
  comic: '<circle cx="12" cy="12" r="8.5"/><path d="M9 10h.01M15 10h.01M8.5 14c1.2 1.6 5.8 1.6 7 0"/>',
  api: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4"/>',
  web: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/>',
  client: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/>',
  controls: '<path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10M11 10V4.5a1.5 1.5 0 0 1 3 0V10M14 10V6a1.5 1.5 0 0 1 3 0v7.5a6 6 0 0 1-6 6h-.5A6.5 6.5 0 0 1 5 13l-.4-1.6a1.5 1.5 0 0 1 2.6-1.3L8 11"/>',
  test: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  map: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10Z"/>',
  data: '<path d="M12 3.5 19 6v6c0 4.2-2.8 7.3-7 8.5C7.8 19.3 5 16.2 5 12V6l7-2.5Z"/>',
  doc: '<path d="M6 3.5h7l5 5v12H6v-17Z"/><path d="M13 3.5v5h5"/>',
};

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
  for (const item of [elements.welcome, elements.selection, elements.searchResults, elements.entryView, elements.editor, elements.docsView]) {
    item.hidden = item !== section;
  }
  elements.mainPanel.scrollTop = 0;
}

function svgIcon(name) {
  const paths = ICONS[name] || ICONS.doc;
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function iconFor(title) {
  const text = title.toLowerCase();
  if (text.includes("overview")) return "overview";
  if (text.includes("what")) return "what";
  if (text.includes("navigation") || text.includes("deep link")) return "link";
  if (text.includes("footer")) return "foot";
  if (text.includes("guide")) return "guide";
  if (text.includes("writing") || text.includes("entry")) return "pencil";
  if (text.includes("install") || text.includes("setup")) return "install";
  if (text.includes("deploy") || text.includes("nas")) return "package";
  if (text.includes("api")) return "api";
  if (text.includes("client") || text.includes("mcp")) return "client";
  if (text.includes("web") || text.includes("endpoint")) return "web";
  if (text.includes("control") || text.includes("access")) return "controls";
  if (text.includes("test")) return "test";
  if (text.includes("map") || text.includes("repository")) return "map";
  if (text.includes("data") || text.includes("trust")) return "data";
  if (text.includes("style") || text.includes("vocabulary")) return "comic";
  return "doc";
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

function readableTestName(name) {
  const marker = name.lastIndexOf(".test_");
  if (marker === -1) return name;
  return name.slice(marker + 6).replace(/_/g, " ");
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
  const page = await request(`/api/search/page?${params}`);
  if (ticket !== state.resultTicket) return;
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

function stopTestPolling() {
  if (state.testTimer === null) return;
  window.clearInterval(state.testTimer);
  state.testTimer = null;
}

function startTestPolling() {
  if (state.testTimer !== null) return;
  state.testTimer = window.setInterval(() => {
    loadMetrics().catch(() => stopTestPolling());
  }, TEST_POLL_MS);
}

function metricParts(label, item) {
  const parts = [`${label} ${item.tests}`];
  if (item.failures) parts.push({ fail: `${item.failures} fail` });
  parts.push(`${item.coverage} %`);
  return parts;
}

function setMetricLabel(node, parts) {
  node.replaceChildren();
  for (const [index, part] of parts.entries()) {
    if (index) node.append(document.createTextNode(" · "));
    if (typeof part === "string") {
      node.append(document.createTextNode(part));
    } else {
      const failure = document.createElement("span");
      failure.className = "fail-count";
      failure.textContent = part.fail;
      node.append(failure);
    }
  }
}

function formatMeasured(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace("T", " ").slice(0, 16);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function measurementTip(item, fallback) {
  const lines = [];
  if (item.measuredAt) lines.push(`Measured: ${formatMeasured(item.measuredAt)}`);
  if (item.durationSeconds) {
    const seconds = Math.max(0, Math.round(Number(item.durationSeconds) || 0));
    lines.push(`Duration: ${seconds} s`);
    if (item.tests) lines.push(`Per test: ${(seconds / item.tests).toFixed(1)} s`);
  }
  return lines.join("\n") || fallback;
}

function renderMetrics(metrics) {
  if (metrics.running) {
    elements.runTests.setAttribute("aria-disabled", "true");
    elements.runTests.classList.add("running");
    elements.unitMetrics.textContent = "unit running…";
    elements.runTests.dataset.tip = "The suite is running";
    startTestPolling();
  } else {
    stopTestPolling();
    elements.runTests.classList.remove("running");
    if (metrics.measuredAt) {
      elements.runTests.setAttribute("aria-disabled", "true");
      setMetricLabel(elements.unitMetrics, metricParts("unit", metrics));
      elements.runTests.dataset.tip = measurementTip(metrics, "Measured once; results are final.");
    } else {
      elements.runTests.setAttribute("aria-disabled", "false");
      elements.unitMetrics.textContent = "unit not measured — run";
      elements.runTests.dataset.tip = "Run the test suite once";
    }
  }
  renderE2E(metrics.e2e);
}

function renderE2E(e2e) {
  if (!e2e) {
    elements.e2eMetricsLabel.textContent = "e2e not measured";
    elements.e2eMetrics.dataset.tip = "Playwright E2E results are not installed here.";
    return;
  }
  setMetricLabel(elements.e2eMetricsLabel, metricParts("e2e", e2e));
  elements.e2eMetrics.dataset.tip = measurementTip(e2e, "Playwright E2E results.");
}

async function loadMetrics() {
  const metrics = await request("/api/metrics");
  state.metrics = metrics;
  renderMetrics(metrics);
  return metrics;
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
    /\[([^\]]+)\]\(((?:\.\.\/)?(?:docs\/[A-Za-z0-9._-]+\.md|README\.md))(#[A-Za-z0-9-]+)?\)/g,
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

async function loadDocs() {
  if (state.docs) return state.docs;
  const result = await request("/api/docs");
  state.docs = Array.isArray(result.documents) ? result : { documents: [] };
  return state.docs;
}

async function renderDocs(doc, page) {
  elements.docsTitle.textContent = doc.title;
  elements.docTabs.replaceChildren();
  for (const item of state.docs.documents) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `doc-tab${item.slug === doc.slug ? " active" : ""}`;
    tab.textContent = item.title;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(item.slug === doc.slug));
    tab.addEventListener("click", () => navigate(ROUTE.docs(item.slug)).catch((error) => showToast(error.message)));
    elements.docTabs.append(tab);
  }
  elements.docSections.replaceChildren();
  for (const item of doc.pages) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `doc-section${item.slug === page.slug ? " active" : ""}`;
    button.innerHTML = svgIcon(iconFor(item.title));
    button.setAttribute("aria-label", item.title);
    button.dataset.tip = item.title;
    button.addEventListener("click", () => navigate(ROUTE.docs(doc.slug, item.slug)).catch((error) => showToast(error.message)));
    elements.docSections.append(button);
  }
  elements.docSectionTitle.textContent = page.title;
  elements.docBody.innerHTML = renderMarkdown(page.markdown);
  if (DOC_SPECS.has(doc.slug)) {
    const metrics = state.metrics || await loadMetrics();
    renderRequirementTests(page.slug, metrics);
  }
  showOnly(elements.docsView);
}

function renderRequirementTests(slug, metrics) {
  const groups = (metrics.requirements || {})[slug] || {};
  const unit = groups.unit || [];
  const e2e = groups.e2e || [];
  const box = document.createElement("section");
  box.className = "doc-tests";
  const heading = document.createElement("h4");
  heading.textContent = "Automated tests";
  box.append(heading);
  if (!unit.length && !e2e.length) {
    const empty = document.createElement("p");
    empty.textContent = "No automated test names this requirement yet.";
    box.append(empty);
  }
  for (const [label, names] of [["Unit", unit], ["E2E", e2e]]) {
    if (!names.length) continue;
    const group = document.createElement("div");
    group.className = "doc-test-group";
    const kind = document.createElement("span");
    kind.className = "doc-test-kind";
    kind.textContent = `${label} · ${names.length}`;
    const list = document.createElement("ol");
    for (const name of names) {
      const item = document.createElement("li");
      item.textContent = label === "Unit" ? readableTestName(name) : name;
      list.append(item);
    }
    group.append(kind, list);
    box.append(group);
  }
  elements.docBody.append(box);
}



async function showDayRoute(date, query = "") {
  if (!ISO_DAY.test(date) || !(await ensureDayWindow(date))) {
    showToast(`${date} has no entries.`);
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

async function showDocsRoute(docSlug, sectionSlug) {
  await loadDocs();
  if (!state.docs.documents.length) {
    showToast("No documentation is installed.");
    return;
  }
  const doc = state.docs.documents.find((item) => item.slug === docSlug) || state.docs.documents[0];
  const page = doc.pages.find((item) => item.slug === sectionSlug) || doc.pages[0];
  await renderDocs(doc, page);
  const canonical = ROUTE.docs(doc.slug, page.slug);
  if (window.location.hash !== canonical) history.replaceState({}, "", canonical);
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
  if (kind === "day" && first) {
    await showDayRoute(first, query);
    return;
  }
  if (kind === "entry" && first) {
    elements.searchInput.value = "";
    await showEntryRoute(first);
    return;
  }
  if (kind === "docs") {
    elements.searchInput.value = "";
    await showDocsRoute(first || "readme", second || null);
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

let tooltipTarget = null;

function showTooltip(target) {
  const text = target.dataset.tip;
  if (!text) return;
  tooltipTarget = target;
  elements.tooltip.textContent = text;
  elements.tooltip.classList.toggle("wide", target.hasAttribute("data-tip-wide"));
  elements.tooltip.hidden = false;
  const rect = target.getBoundingClientRect();
  const tip = elements.tooltip.getBoundingClientRect();
  const margin = 8;
  let left = rect.left + rect.width / 2 - tip.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - tip.width - margin));
  let top = rect.top - tip.height - 10;
  let placement = "top";
  if (top < margin) {
    top = rect.bottom + 10;
    placement = "bottom";
  }
  elements.tooltip.style.left = `${Math.round(left)}px`;
  elements.tooltip.style.top = `${Math.round(top)}px`;
  elements.tooltip.dataset.placement = placement;
}

function hideTooltip() {
  tooltipTarget = null;
  elements.tooltip.hidden = true;
}

document.addEventListener("pointerover", (event) => {
  const target = event.target.closest?.("[data-tip]");
  if (!target) return;
  if (event.relatedTarget && target.contains(event.relatedTarget)) return;
  showTooltip(target);
});
document.addEventListener("pointerout", (event) => {
  const target = event.target.closest?.("[data-tip]");
  if (!target) return;
  if (event.relatedTarget && target.contains(event.relatedTarget)) return;
  hideTooltip();
});
document.addEventListener("focusin", (event) => {
  const target = event.target.closest?.("[data-tip]");
  if (target) showTooltip(target);
});
document.addEventListener("focusout", hideTooltip);
function repositionTooltip() {
  if (tooltipTarget && !elements.tooltip.hidden) showTooltip(tooltipTarget);
}
window.addEventListener("scroll", repositionTooltip, true);
window.addEventListener("resize", repositionTooltip);

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
elements.runTests.addEventListener("click", async () => {
  if (elements.runTests.getAttribute("aria-disabled") === "true") return;
  elements.runTests.setAttribute("aria-disabled", "true");
  try {
    await request("/api/tests", { method: "POST" });
    elements.runTests.classList.add("running");
    elements.unitMetrics.textContent = "unit running…";
    startTestPolling();
  } catch (error) {
    elements.runTests.setAttribute("aria-disabled", "false");
    showToast(error.message);
    loadMetrics().catch(() => {});
  }
});
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
elements.readmeButton.addEventListener("click", () => navigate(ROUTE.docs("readme")).catch((error) => showToast(error.message)));
elements.docsBack.addEventListener("click", () => navigate(state.selectedDate ? ROUTE.day(state.selectedDate) : ROUTE.welcome).catch((error) => showToast(error.message)));

function followDocLink(event) {
  const link = event.target.closest?.("a[data-doc-link]");
  if (!link) return;
  event.preventDefault();
  const [slug, section] = link.dataset.docLink.split("#");
  navigate(ROUTE.docs(slug, section || "overview")).catch((error) => showToast(error.message));
}

elements.docBody.addEventListener("click", followDocLink);
elements.entryView.addEventListener("click", followDocLink);


window.addEventListener("popstate", () => { applyRoute().catch((error) => showToast(error.message)); });
window.addEventListener("hashchange", () => { applyRoute().catch((error) => showToast(error.message)); });

async function init() {
  await loadDayPage(0);
  await loadTags();
  loadMetrics().catch(() => {});
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

init().catch((error) => showToast(error.message));

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
  entryList: document.getElementById("entry-list"),
  searchResults: document.getElementById("search-results"),
  searchTitle: document.getElementById("search-title"),
  resultList: document.getElementById("result-list"),
  entryView: document.getElementById("entry-view"),
  runTests: document.getElementById("run-tests"),
  sparkButton: document.getElementById("spark-button"),
  guideButton: document.getElementById("guide-button"),
  editor: document.getElementById("editor"),
  backToJournal: document.getElementById("back-to-journal"),
  skillEditor: document.getElementById("skill-editor"),
  saveSkill: document.getElementById("save-skill"),
  saveStatus: document.getElementById("save-status"),
  deleteDay: document.getElementById("delete-day"),
  deleteDayButton: document.getElementById("delete-day-button"),
  deleteBefore: document.getElementById("delete-before"),
  deleteBeforeButton: document.getElementById("delete-before-button"),
  deleteStatus: document.getElementById("delete-status"),
  toast: document.getElementById("toast"),
};

const PAGE_SIZE = 7;
const TEST_POLL_MS = 5000;

const state = {
  days: [],
  pageOffset: 0,
  pageSize: PAGE_SIZE,
  totalDays: 0,
  totalEntries: 0,
  latestDate: null,
  pages: new Map(),
  selectedDate: null,
  entries: [],
  searchTimer: null,
  testTimer: null,
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
}

function renderDays() {
  elements.dayCount.textContent = String(state.totalEntries);
  elements.dayCount.title = `${state.totalEntries} ${state.totalEntries === 1 ? "entry" : "entries"} in ${state.totalDays} ${state.totalDays === 1 ? "day" : "days"}`;
  elements.dayList.replaceChildren();
  for (const day of state.days) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-button${state.selectedDate === day.date ? " active" : ""}`;
    const date = document.createElement("span");
    date.textContent = day.date;
    const count = document.createElement("span");
    count.textContent = `${day.count} ${day.count === 1 ? "note" : "notes"}`;
    button.append(date, count);
    button.addEventListener("click", () => selectDay(day.date));
    elements.dayList.append(button);
  }
  const first = state.totalDays ? state.pageOffset + 1 : 0;
  const last = state.pageOffset + state.days.length;
  elements.dayRange.textContent = state.totalDays ? `${first}–${last} / ${state.totalDays}` : "";
  elements.daysNewer.disabled = state.pageOffset <= 0;
  elements.daysOlder.disabled = last >= state.totalDays;
}

function renderEntryCards(entries, container, returnTo = elements.selection) {
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
    const date = document.createElement("span");
    date.className = "date-label";
    date.textContent = entry.date;
    const title = document.createElement("h3");
    title.textContent = entry.title;
    const preview = document.createElement("p");
    preview.textContent = entry.content.replace(/^#+\s*/gm, "").replace(/\s+/g, " ").slice(0, 84);
    button.append(date, title, preview);
    button.addEventListener("click", () => openEntry(entry, returnTo));
    container.append(button);
  }
}

async function selectDay(day) {
  state.selectedDate = day;
  state.entries = await request(`/api/entries?${new URLSearchParams({ date: day })}`);
  elements.selectedDate.textContent = day;
  renderDays();
  renderEntryCards(state.entries, elements.entryList);
  showOnly(elements.selection);
}

function openEntry(entry, from = elements.selection) {
  showOnly(elements.entryView);
  elements.entryView.replaceChildren();
  const meta = document.createElement("div");
  meta.className = "entry-meta";
  const date = document.createElement("span");
  date.className = "date-label";
  date.textContent = entry.date;
  const back = document.createElement("button");
  back.type = "button";
  back.className = "back-button";
  back.textContent = "← Back";
  back.addEventListener("click", () => showOnly(from));
  meta.append(date, back);
  const title = document.createElement("h2");
  title.textContent = entry.title;
  const content = document.createElement("pre");
  content.className = "entry-content";
  content.textContent = entry.content;
  elements.entryView.append(meta, title, content);
}

async function search() {
  const query = elements.searchInput.value.trim();
  if (!query) {
    renderDays();
    showOnly(state.selectedDate ? elements.selection : elements.welcome);
    return;
  }
  const results = await request(`/api/search?q=${encodeURIComponent(query)}`);
  elements.searchTitle.textContent = `${results.length} ${results.length === 1 ? "thread" : "threads"} found`;
  renderEntryCards(results, elements.resultList, elements.searchResults);
  showOnly(elements.searchResults);
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

function renderMetrics(metrics) {
  if (metrics.running) {
    elements.runTests.disabled = true;
    elements.runTests.classList.add("running");
    elements.runTests.textContent = "Running the tests…";
    startTestPolling();
    return;
  }
  stopTestPolling();
  elements.runTests.disabled = false;
  elements.runTests.classList.remove("running");
  elements.runTests.textContent = metrics.coverage === null
    ? "Tests not measured yet — run them"
    : `${metrics.tests} tests · ${metrics.failures} failures · ${metrics.coverage}% application line coverage`;
  elements.runTests.title = metrics.measuredAt ? `Last measured ${metrics.measuredAt}. Run again.` : "Run the test suite";
}

async function loadMetrics() {
  renderMetrics(await request("/api/metrics"));
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

async function loadDays() {
  await loadDayPage(0);
  if (state.days.length) await selectDay(state.days[0].date);
  await loadMetrics();
}

async function openEditor() {
  const skill = await request("/api/skill");
  elements.skillEditor.value = skill;
  showOnly(elements.editor);
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
    state.selectedDate = null;
    await loadDayPage(0);
    if (state.days.length) await selectDay(state.days[0].date);
    else showOnly(elements.welcome);
  } catch (error) {
    elements.deleteStatus.textContent = error.message;
  }
}

elements.daysNewer.addEventListener("click", () => loadDayPage(state.pageOffset - state.pageSize).catch((error) => showToast(error.message)));
elements.daysOlder.addEventListener("click", () => loadDayPage(state.pageOffset + state.pageSize).catch((error) => showToast(error.message)));
elements.runTests.addEventListener("click", async () => {
  if (elements.runTests.disabled) return;
  elements.runTests.disabled = true;
  try {
    await request("/api/tests", { method: "POST" });
    elements.runTests.classList.add("running");
    elements.runTests.textContent = "Running the tests…";
    startTestPolling();
  } catch (error) {
    elements.runTests.disabled = false;
    showToast(error.message);
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
elements.guideButton.addEventListener("click", () => openEditor().catch((error) => showToast(error.message)));
elements.backToJournal.addEventListener("click", () => showOnly(state.selectedDate ? elements.selection : elements.welcome));
elements.saveSkill.addEventListener("click", async () => {
  elements.saveStatus.textContent = "";
  try {
    await request("/api/skill", { method: "PUT", body: JSON.stringify({ content: elements.skillEditor.value }) });
    elements.saveStatus.textContent = "Guide saved. The next session will read this version.";
  } catch (error) { elements.saveStatus.textContent = error.message; }
});
elements.deleteDayButton.addEventListener("click", () => {
  if (elements.deleteDay.value) deleteBy({ date: elements.deleteDay.value }, `all entries for ${elements.deleteDay.value}`);
});
elements.deleteBeforeButton.addEventListener("click", () => {
  if (elements.deleteBefore.value) deleteBy({ before: elements.deleteBefore.value }, `all entries through ${elements.deleteBefore.value}`);
});
elements.sparkButton.addEventListener("click", async () => {
  const entries = await request("/api/search?q=");
  const older = entries.filter((entry) => entry.date !== state.latestDate);
  if (!older.length) { showToast("A spark needs a little more history to travel through."); return; }
  const memory = older[Math.floor(Math.random() * older.length)];
  openEntry(memory, elements.selection);
  elements.entryView.classList.remove("spark");
  void elements.entryView.offsetWidth;
  elements.entryView.classList.add("spark");
  showToast(`A little echo from ${memory.date}`);
});

loadDays().catch((error) => showToast(error.message));

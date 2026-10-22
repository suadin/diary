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
  runTests: document.getElementById("run-tests"),
  sparkButton: document.getElementById("spark-button"),
  guideButton: document.getElementById("guide-button"),
  editor: document.getElementById("editor"),
  backToJournal: document.getElementById("back-to-journal"),
  skillEditor: document.getElementById("skill-editor"),
  guideToggle: document.getElementById("guide-toggle"),
  saveSkill: document.getElementById("save-skill"),
  saveStatus: document.getElementById("save-status"),
  deleteDay: document.getElementById("delete-day"),
  deleteDayButton: document.getElementById("delete-day-button"),
  deleteBefore: document.getElementById("delete-before"),
  deleteBeforeButton: document.getElementById("delete-before-button"),
  deleteStatus: document.getElementById("delete-status"),
  readmeButton: document.getElementById("readme-button"),
  readmeView: document.getElementById("readme-view"),
  readmeTitle: document.getElementById("readme-title"),
  readmeBody: document.getElementById("readme-body"),
  readmeRange: document.getElementById("readme-range"),
  readmePrev: document.getElementById("readme-prev"),
  readmeNext: document.getElementById("readme-next"),
  readmeBack: document.getElementById("readme-back"),
  toast: document.getElementById("toast"),
};

const PAGE_SIZE = 7;
const ENTRY_PAGE_SIZE = 5;
const TEST_POLL_MS = 5000;
const ENTRY_WARN = 2000;
const ENTRY_CRITICAL = 5000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

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
  readme: null,
  readmeIndex: 0,
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
  for (const item of [elements.welcome, elements.selection, elements.searchResults, elements.entryView, elements.editor, elements.readmeView]) {
    item.hidden = item !== section;
  }
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
  elements.dayCount.dataset.tip = `${total} ${total === 1 ? "entry" : "entries"} in ${state.totalDays} ${state.totalDays === 1 ? "day" : "days"} — ${health}`;
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
    button.addEventListener("click", () => selectDay(day.date).catch((error) => showToast(error.message)));
    elements.dayList.append(button);
  }
  const first = state.totalDays ? state.pageOffset + 1 : 0;
  const last = state.pageOffset + state.days.length;
  elements.dayRange.textContent = state.totalDays ? `${first}–${last} / ${state.totalDays}` : "";
  elements.daysNewer.disabled = state.pageOffset <= 0;
  elements.daysOlder.disabled = last >= state.totalDays;
}

function entryTime(entry) {
  const created = entry.createdAt ? new Date(entry.createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) return "12.00";
  const localDay = [
    created.getFullYear(),
    String(created.getMonth() + 1).padStart(2, "0"),
    String(created.getDate()).padStart(2, "0"),
  ].join("-");
  if (localDay !== entry.date) return "12.00";
  return `${String(created.getHours()).padStart(2, "0")}.${String(created.getMinutes()).padStart(2, "0")}`;
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
    const title = document.createElement("h3");
    title.textContent = entry.title;
    const preview = document.createElement("p");
    preview.textContent = entry.content.replace(/^#+\s*/gm, "").replace(/\s+/g, " ").slice(0, 84);
    button.append(dateLabel(entry), title, preview);
    button.addEventListener("click", () => openEntry(entry, returnTo));
    container.append(button);
  }
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

async function goToAdjacentDay(direction) {
  const index = state.days.findIndex((day) => day.date === state.selectedDate);
  if (index === -1) return;
  let target = state.days[index + direction];
  if (!target) {
    if (direction > 0) {
      const next = state.pageOffset + state.pageSize;
      if (next >= state.totalDays) {
        showToast("This is the oldest day.");
        return;
      }
      await loadDayPage(next);
      target = state.days[0];
    } else {
      const previous = state.pageOffset - state.pageSize;
      if (previous < 0) {
        showToast("This is the newest day.");
        return;
      }
      await loadDayPage(previous);
      target = state.days[state.days.length - 1];
    }
  }
  if (target && target.date !== state.selectedDate) await selectDay(target.date, direction);
}

function openEntry(entry, from = elements.selection) {
  showOnly(elements.entryView);
  elements.entryView.replaceChildren();
  const meta = document.createElement("div");
  meta.className = "entry-meta";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "back-button";
  back.textContent = "← Back";
  back.addEventListener("click", () => showOnly(from));
  meta.append(dateLabel(entry), back);
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
    elements.runTests.dataset.tip = "The suite is running";
    startTestPolling();
    return;
  }
  stopTestPolling();
  elements.runTests.classList.remove("running");
  if (metrics.measuredAt) {
    elements.runTests.disabled = true;
    elements.runTests.textContent = `${metrics.tests} tests · ${metrics.failures} failures · ${metrics.coverage}% application line coverage`;
    elements.runTests.dataset.tip = `Measured ${metrics.measuredAt}. Results are final.`;
    return;
  }
  elements.runTests.disabled = false;
  elements.runTests.textContent = "Tests not measured yet — run them";
  elements.runTests.dataset.tip = "Run the test suite once";
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
    await loadDayPage(0);
    if (state.days.length) await selectDay(state.days[0].date);
    else showOnly(elements.welcome);
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
    const heading = /^#{3,6}\s+(.*)$/.exec(line);
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
      continue;
    }
    closeList();
    paragraph.push(line.trim());
  }
  if (fence !== null) html.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
  closeBlocks();
  return html.join("");
}

function renderReadmePage() {
  const pages = state.readme?.pages || [];
  if (!pages.length) {
    elements.readmeTitle.textContent = "README";
    elements.readmeBody.textContent = "The README is not available in this installation.";
    elements.readmeRange.textContent = "";
    elements.readmePrev.disabled = true;
    elements.readmeNext.disabled = true;
    return;
  }
  const page = pages[state.readmeIndex];
  elements.readmeTitle.textContent = page.title;
  elements.readmeBody.innerHTML = renderMarkdown(page.markdown);
  elements.readmeRange.textContent = `${state.readmeIndex + 1} / ${pages.length}`;
  elements.readmePrev.disabled = state.readmeIndex <= 0;
  elements.readmeNext.disabled = state.readmeIndex >= pages.length - 1;
}

async function openReadme() {
  if (!state.readme) state.readme = await request("/api/readme");
  renderReadmePage();
  showOnly(elements.readmeView);
}

elements.daysNewer.addEventListener("click", () => loadDayPage(state.pageOffset - state.pageSize).catch((error) => showToast(error.message)));
elements.daysOlder.addEventListener("click", () => loadDayPage(state.pageOffset + state.pageSize).catch((error) => showToast(error.message)));
elements.dayNewer.addEventListener("click", () => goToAdjacentDay(-1).catch((error) => showToast(error.message)));
elements.dayOlder.addEventListener("click", () => goToAdjacentDay(1).catch((error) => showToast(error.message)));
elements.entriesNewer.addEventListener("click", () => loadEntryPage(state.entryOffset - ENTRY_PAGE_SIZE).catch((error) => showToast(error.message)));
elements.entriesOlder.addEventListener("click", () => loadEntryPage(state.entryOffset + ENTRY_PAGE_SIZE).catch((error) => showToast(error.message)));
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
elements.guideButton.addEventListener("click", () => openEditor().catch((error) => showToast(error.message)));
elements.backToJournal.addEventListener("click", () => showOnly(state.selectedDate ? elements.selection : elements.welcome));
elements.guideToggle.addEventListener("click", () => {
  setGuideExpanded(elements.guideToggle.getAttribute("aria-expanded") !== "true");
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
elements.readmeButton.addEventListener("click", () => openReadme().catch((error) => showToast(error.message)));
elements.readmeBack.addEventListener("click", () => showOnly(state.selectedDate ? elements.selection : elements.welcome));
elements.readmePrev.addEventListener("click", () => {
  if (state.readmeIndex > 0) {
    state.readmeIndex -= 1;
    renderReadmePage();
  }
});
elements.readmeNext.addEventListener("click", () => {
  if (state.readme && state.readmeIndex < state.readme.pages.length - 1) {
    state.readmeIndex += 1;
    renderReadmePage();
  }
});

loadDays().catch((error) => showToast(error.message));

const { test, expect } = require("@playwright/test");
const { startCoverage, stopCoverage } = require("./coverage");

test("a journey through days, entries, documents, and the guide", { tag: ["@entries-and-writing", "@navigation-and-deep-links", "@documentation-reader", "@writing-guide"] }, async ({ page }) => {
  const measured = await startCoverage(page);
  try {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Entries");
    await expect(page).toHaveURL(/#\/day\/2026-10-22$/);
    await expect(page.locator(".entry-card")).toHaveCount(7);
    await expect(page.locator("#entry-pager")).toBeHidden();

    await page.locator(".entry-card").first().click();
    await expect(page.locator("#entry-view h2")).toBeVisible();
    await expect(page.locator(".entry-author")).toContainText("by ");
    await expect(page.locator(".entry-when .date-time")).toBeVisible();
    await page.locator(".back-button").click();
    await expect(page.locator("#selection")).toBeVisible();

    await page.locator("#day-older").click();
    await expect(page.locator("#selected-date")).toHaveText("2026-10-21");

    const entries = await (await page.request.get("/api/entries?date=2026-10-22")).json();
    await page.goto(`/#/entry/${entries[0].id}`);
    await expect(page.locator("#entry-view h2")).toHaveText(entries[0].title);
    await expect(page).toHaveURL(new RegExp(`#/entry/${entries[0].id}$`));

    await page.goto("/#/docs/readme");
    await expect(page.locator(".doc-tab")).toHaveCount(2);
    await expect(page.locator(".doc-section")).toHaveCount(11);
    await page.locator('.doc-section[data-tip="AI API"]').click();
    await expect(page.locator("#doc-section-title")).toHaveText("AI API");
    await expect(page).toHaveURL(/#\/docs\/readme\/ai-api$/);
    await expect(page.locator("#doc-body")).toContainText("/ai/entries");

    await page.locator(".doc-tab", { hasText: "SPECS" }).click();
    await expect(page.locator("#docs-title")).toHaveText("SPECS");
    await expect(page).toHaveURL(/#\/docs\/specs\/overview$/);

    await page.goto("/#/guide");
    await page.locator("#skill-editor").fill("# Changed\n");
    await page.locator("#save-skill").click();
    await expect(page.locator("#save-status")).toContainText("Guide saved");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#guide-reset").click();
    await expect(page.locator("#skill-editor")).toHaveValue(/# AI diary writing guide/);
    await expect(page.locator("#save-status")).toContainText("Guide reset");

    await page.locator("#back-to-journal").click();
    await page.locator("#day-count").click();
    await page.locator("#search-input").fill("Deep links");
    await expect(page.locator(".result-card")).toHaveCount(1);
    await page.locator(".result-card").click();
    await expect(page.locator("#entry-view h2")).toContainText("Deep links");

    await page.locator("#spark-button").click();
    await expect(page.locator("#entry-view h2")).toBeVisible();
  } finally {
    await stopCoverage(page, measured);
  }
});

test("entry content renders as Markdown", { tag: ["@entries-and-writing"] }, async ({ page }) => {
  await page.goto("/");
  await page.locator("#day-count").click();
  await page.locator("#search-input").fill("Deep links");
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(page.locator(".result-card p")).not.toContainText("**");
  await page.locator(".result-card").click();
  await expect(page.locator("#entry-view strong").first()).toHaveText("icons");
  await expect(page.locator("#entry-view ul li")).toHaveCount(2);
  await expect(page.locator("#entry-view h4")).toHaveText("Detail");
  await expect(page.locator("#entry-view code")).toContainText("ROUTE.docs");
  await expect(page.locator("#entry-view")).not.toContainText("**");
});

test("tag chips filter entries by title topic", { tag: ["@navigation-and-deep-links"] }, async ({ page }) => {
  await page.route("**/api/tags", (route) => route.fulfill({
    json: [
      { tag: "Diary", count: 1 },
      { tag: "Topic", count: 1 },
      ...Array.from({ length: 11 }, (_, index) => ({ tag: `Topic ${index}`, count: 1 })),
    ],
  }));
  await page.goto("/");
  const chips = page.locator(".tag-chip");
  await expect(chips).toHaveCount(13);
  await expect(page.locator('.tag-chip[data-tag="Diary"]')).toContainText("1");

  await page.locator('.tag-chip[data-tag="Diary"]').click();
  await expect(page).toHaveURL(/#\/tag\/Diary$/);
  await expect(page.locator("#search-title")).toHaveText("Diary");
  await expect(page.locator(".result-card")).toHaveCount(2);
  await expect(page.locator("#result-list")).toContainText("Deep links added");
  await expect(page.locator('.tag-chip[data-tag="Diary"]')).toHaveClass(/active/);
  await expect(page.locator(".day-button.active")).toHaveCount(0);

  await page.locator("#readme-button").click();
  await expect(page).toHaveURL(/#\/docs\/readme/);
  await expect(page.locator('.tag-chip[data-tag="Diary"]')).not.toHaveClass(/active/);

  await page.goto("/#/tag/Diary");
  await page.locator('.tag-chip[data-tag="Diary"]').click();
  await expect(page).toHaveURL(/#\/day\/2026-10-22$/);
  await expect(page.locator(".day-button.active")).toHaveCount(1);
});

test("search narrows the selected tag", { tag: ["@navigation-and-deep-links"] }, async ({ page }) => {
  await page.goto("/#/tag/Diary");
  await expect(page.locator(".result-card")).toHaveCount(2);
  await page.locator("#search-input").fill("alpha");
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(page.locator(".result-card h3")).toHaveText("Diary — Second note");
  await expect(page.locator("#search-title")).toHaveText("Diary (filtered)");
  await expect(page).toHaveURL(/#\/tag\/Diary\?q=alpha$/);
  await page.locator("#search-input").fill("");
  await expect(page.locator(".result-card")).toHaveCount(2);
  await expect(page.locator("#search-title")).toHaveText("Diary");
  await expect(page).toHaveURL(/#\/tag\/Diary$/);
});

test("search narrows the selected date and the sidebar note is gone", { tag: ["@navigation-and-deep-links"] }, async ({ page }) => {
  await page.goto("/#/day/2026-10-22");
  await expect(page.locator("#selection")).toBeVisible();
  await expect(page.locator(".sidebar-note")).toHaveCount(0);
  await page.locator("#search-input").fill("Today 3");
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(page.locator(".result-card h3")).toHaveText("Today 3");
  await expect(page.locator("#search-title")).toHaveText("2026-10-22 (filtered)");
  await expect(page).toHaveURL(/#\/day\/2026-10-22\?q=Today%203$/);
  await page.locator("#search-input").fill("");
  await expect(page.locator("#selection")).toBeVisible();
});

test("the entry count opens the whole journal, and search runs inside it", { tag: ["@navigation-and-deep-links"] }, async ({ page }) => {
  await page.goto("/#/day/2026-10-22");
  await page.locator("#day-count").click();
  await expect(page).toHaveURL(/#\/all$/);
  await expect(page.locator(".result-card")).toHaveCount(10);
  await expect(page.locator("#result-range")).toHaveText(/^1–10 \/ \d+$/);
  await page.locator("#search-input").fill("alpha");
  await expect(page.locator(".result-card")).toHaveCount(2);
  await expect(page.locator("#search-title")).toHaveText("2 entries matching “alpha”");
  await expect(page.locator("#result-pager")).toBeHidden();
});

test("tag results page ten at a time", { tag: ["@navigation-and-deep-links"] }, async ({ page }) => {
  await page.goto("/#/tag/Hub");
  await expect(page.locator(".result-card")).toHaveCount(10);
  await expect(page.locator("#result-range")).toHaveText("1–10 / 11");
  await page.locator("#results-older").click();
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(page.locator("#result-range")).toHaveText("11–11 / 11");
  await page.locator("#results-newer").click();
  await expect(page.locator(".result-card")).toHaveCount(10);
});

test("deep links restore the search text and typing updates the link", { tag: ["@navigation-and-deep-links"] }, async ({ page }) => {
  await page.goto("/#/tag/Diary?q=alpha");
  await expect(page.locator("#search-input")).toHaveValue("alpha");
  await expect(page.locator(".result-card")).toHaveCount(1);
  await expect(page.locator("#search-title")).toHaveText("Diary (filtered)");

  await page.goto("/#/day/2026-10-22?q=Today%203");
  await expect(page.locator("#search-input")).toHaveValue("Today 3");
  await expect(page.locator(".result-card")).toHaveCount(1);

  await page.goto("/#/all?q=alpha");
  await expect(page.locator("#search-input")).toHaveValue("alpha");
  await expect(page.locator(".result-card")).toHaveCount(2);

  await page.goto("/#/day/2026-10-22");
  await page.locator("#search-input").fill("Today 5");
  await expect(page).toHaveURL(/#\/day\/2026-10-22\?q=Today%205$/);
  await page.locator("#search-input").fill("");
  await expect(page).toHaveURL(/#\/day\/2026-10-22$/);
});

test("the header, footer and sidebar stay in place, and the card is the scrolling part", { tag: ["@style-and-vocabulary"] }, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/#/docs/readme/what-it-does");
  await expect(page.locator("#doc-body")).toBeVisible();
  await expect(page.locator(".eyebrow", { hasText: "Looking back" })).toHaveCount(0);
  await expect(page.locator(".sidebar-note")).toHaveCount(0);
  const bottom = await page.locator(".footer").boundingBox();
  expect(bottom.y + bottom.height).toBeCloseTo(1080, 0);
  await expect(page.locator(".topbar")).toBeInViewport();
  await expect(page.locator(".sidebar")).toBeInViewport();
});

test("layout sizes follow the viewport, so 1080p, 1440p and 2160p look alike", { tag: ["@style-and-vocabulary"] }, async ({ page }) => {
  const ratio = async (width, height) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const side = await page.locator(".sidebar").boundingBox();
    return Math.round((side.width / width) * 1000) / 1000;
  };
  const fullHd = await ratio(1920, 1080);
  expect(await ratio(2560, 1440)).toBeCloseTo(fullHd, 2);
  expect(await ratio(3840, 2160)).toBeCloseTo(fullHd, 2);
});

test("the show-all bubble wobbles on hover and the selected doc is yellow", { tag: ["@style-and-vocabulary", "@documentation-reader"] }, async ({ page }) => {
  await page.goto("/");
  await page.locator("#day-count").hover();
  await expect(page.locator("#day-count")).toHaveCSS("animation-name", "wiggle");
  await page.goto("/#/docs/readme/what-it-does");
  await expect(page.locator(".doc-tab.active")).toHaveCSS("background-color", "rgb(255, 212, 92)");
});

test("entry cards browse the list they came from", { tag: ["@navigation-and-deep-links"] }, async ({ page }) => {
  await page.goto("/#/day/2026-10-22");
  await page.locator(".entry-card").first().click();
  await expect(page.locator("#entry-view h2")).toHaveText("Today 7");
  await expect(page.locator(".link-button", { hasText: "‹ Newer" })).toBeDisabled();
  await page.locator(".link-button", { hasText: "Older ›" }).click();
  await expect(page.locator("#entry-view h2")).toHaveText("Today 6");
  await page.locator(".link-button", { hasText: "‹ Newer" }).click();
  await expect(page.locator("#entry-view h2")).toHaveText("Today 7");

  await page.goto("/#/all?q=alpha");
  await page.locator(".result-card").first().click();
  await expect(page.locator("#entry-view h2")).toHaveText("Hub — Boot note");
  await page.locator(".link-button", { hasText: "Older ›" }).click();
  await expect(page.locator("#entry-view h2")).toHaveText("Diary — Second note");
  await expect(page.locator(".link-button", { hasText: "Older ›" })).toBeDisabled();
  await page.locator(".back-button").click();
  await expect(page).toHaveURL(/#\/all\?q=alpha$/);
  await expect(page.locator("#search-input")).toHaveValue("alpha");
  await expect(page.locator(".result-card")).toHaveCount(2);
});

test("the day pager sits under the day list, and no day is marked in the docs", { tag: ["@navigation-and-deep-links", "@documentation-reader"] }, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/#/day/2026-10-22");
  const list = await page.locator("#day-list").boundingBox();
  const pager = await page.locator(".day-pager").boundingBox();
  expect(pager.y - (list.y + list.height)).toBeLessThan(24);
  await expect(page.locator(".day-button.active")).toHaveCount(1);
  await page.goto("/#/docs/readme/what-it-does");
  await expect(page.locator(".day-button.active")).toHaveCount(0);
  await expect(page.locator(".tag-chip.active")).toHaveCount(0);
});

test("the sidebar is wider and the card spans the main panel", { tag: ["@style-and-vocabulary"] }, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/#/day/2026-10-22");
  const side = await page.locator(".sidebar").boundingBox();
  expect(side.width).toBeCloseTo(384, 0);
  const main = await page.locator("#main-panel").evaluate((node) => ({
    width: node.clientWidth,
    padding: parseFloat(getComputedStyle(node).paddingLeft),
  }));
  const card = await page.locator("#selection").boundingBox();
  expect(card.width).toBeCloseTo(main.width - 2 * main.padding, 0);
});

test("footer test tooltips are wide, other tooltips stay narrow", { tag: ["@footer", "@tests"] }, async ({ page }) => {
  await page.goto("/");
  await page.locator("#run-tests").hover();
  await expect(page.locator("#tooltip")).toHaveClass(/wide/);
  await page.locator("#day-count").hover();
  await expect(page.locator("#tooltip")).not.toHaveClass(/wide/);
});

test("the writing guide grows to at most twice its compact height", { tag: ["@writing-guide"] }, async ({ page }) => {
  await page.goto("/#/guide");
  const compact = await page.locator("#skill-editor").evaluate((node) => parseFloat(getComputedStyle(node).maxHeight));
  await page.locator("#guide-toggle").click();
  await expect.poll(() => page.locator("#skill-editor").evaluate((node) => parseFloat(getComputedStyle(node).maxHeight))).toBeCloseTo(compact * 2, 0);
});

test("documentation wraps bullets, follows links, and the card scrolls", { tag: ["@documentation-reader"] }, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/#/docs/readme/what-it-does");
  await expect(page.locator("#doc-body li").first()).toContainText("previous or next window");
  const pageFits = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);
  expect(pageFits).toBe(true);
  const card = await page.locator("#main-panel").evaluate((node) => ({ scrolls: node.scrollHeight > node.clientHeight, overflow: getComputedStyle(node).overflowY }));
  expect(card).toEqual({ scrolls: true, overflow: "auto" });
  for (const selector of [".topbar", "#day-list", ".footer"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(1080);
  }

  await page.goto("/#/docs/readme/tests-and-coverage");
  await page.locator('a[data-doc-link="specs#tests"]').click();
  await expect(page).toHaveURL(/#\/docs\/specs\/tests$/);
  await expect(page.locator("#doc-section-title")).toHaveText("Tests");

  await page.goto("/#/docs/specs/overview");
  await page.locator('a[data-doc-link="readme#overview"]').first().click();
  await expect(page).toHaveURL(/#\/docs\/readme\/overview$/);
});

test("specs sections use distinct icons", { tag: ["@documentation-reader", "@style-and-vocabulary"] }, async ({ page }) => {
  await page.goto("/#/docs/specs");
  const icons = await page.locator(".doc-section svg").evaluateAll(
    (nodes) => nodes.map((node) => node.innerHTML),
  );
  expect(icons).toHaveLength(13);
  expect(new Set(icons).size).toBe(13);
});

test("tooltip-only text uses the help cursor and the sidebar stays fixed", { tag: ["@style-and-vocabulary"] }, async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#e2e-metrics")).toHaveCSS("cursor", "help");
  await expect(page.locator("#readme-button")).toHaveCSS("cursor", "pointer");
  await expect(page.locator("#day-list")).toHaveCSS("overflow-x", "hidden");
  await page.locator(".day-button").first().hover();
  await expect(page.locator("#day-list")).toHaveCSS("overflow-x", "hidden");
});

test("the layout spans the full width like the header", { tag: ["@style-and-vocabulary"] }, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  for (const selector of [".topbar", ".layout", ".footer"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box.x).toBeCloseTo(0, 0);
    expect(box.width).toBeCloseTo(1920, 0);
  }
});

test("the welcome panel does not flash before the first route", { tag: ["@navigation-and-deep-links"] }, async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/days/page?*", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/#/day/2026-10-22", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#welcome")).toBeHidden();
  release();
  await expect(page.locator("#selected-date")).toHaveText("2026-10-22");
  await expect(page.locator("#welcome")).toBeHidden();
});

test("an unknown deep link returns to the start", { tag: ["@navigation-and-deep-links"] }, async ({ page }) => {
  await page.goto("/#/day/2020-01-01");
  await expect(page.locator("#welcome")).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);

  await page.goto("/#/entry/99999");
  await expect(page.locator("#welcome")).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);

  await page.goto("/#/docs/readme/tests-and-coverage");
  await expect(page.locator("#doc-section-title")).toHaveText("Tests and coverage");
});

test("day arrows cross the seven-day window", { tag: ["@navigation-and-deep-links"] }, async ({ page }) => {
  await page.goto("/#/day/2026-10-15");
  await expect(page.locator("#selected-date")).toHaveText("2026-10-15");
  await expect(page.locator("#day-range")).toHaveText("1–7 / 12");
  await page.locator("#day-older").click();
  await expect(page.locator("#selected-date")).toHaveText("2026-10-14");
  await expect(page.locator("#day-range")).toHaveText("8–12 / 12");
  await expect(page).toHaveURL(/#\/day\/2026-10-14$/);
});

test("tooltips stay inside the viewport", { tag: ["@style-and-vocabulary"] }, async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 620 });
  await page.goto("/");
  const tooltip = page.locator("#tooltip");

  await page.locator("#day-count").hover();
  await expect(tooltip).toBeVisible();
  let box = await tooltip.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(900);

  await page.locator("#e2e-metrics").hover();
  await expect(tooltip).toBeVisible();
  box = await tooltip.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(900);
  expect(box.y).toBeGreaterThanOrEqual(0);
});

test("the footer is centred with separators and renders end-to-end numbers", { tag: ["@footer", "@tests"] }, async ({ page }) => {
  await page.route("**/api/metrics", (route) => route.fulfill({
    json: {
      tests: 42,
      failures: 0,
      coverage: 75.5,
      measuredAt: "2026-10-22T14:00:00+00:00",
      durationSeconds: 84,
      running: false,
      e2e: {
        tests: 12,
        failures: 0,
        coverage: 61.5,
        measuredAt: "2026-10-22T14:00:00+00:00",
        durationSeconds: 84,
      },
    },
  }));
  await page.goto("/");
  await expect(page.locator("#e2e-metrics")).toHaveText("e2e 12 · 61.5 %");
  await expect(page.locator(".footer-sep")).toHaveCount(3);
  await expect(page.locator(".footer-items svg")).toHaveCount(4);
  await expect(page.locator(".fail-count")).toHaveCount(0);
  const tip = await page.locator("#e2e-metrics").getAttribute("data-tip");
  expect(tip).toContain("Measured: 2026-10-22");
  expect(tip).toContain("Duration: 01:24 minutes");

  const boxes = await page.locator(".footer-items > *").evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return rect.top + rect.height / 2;
  }));
  expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(3);

  await page.unroute("**/api/metrics");
  await page.route("**/api/metrics", (route) => route.fulfill({
    json: {
      tests: 42,
      failures: 2,
      coverage: 75.5,
      measuredAt: "2026-10-22T14:00:00+00:00",
      running: false,
      e2e: { tests: 12, failures: 1, coverage: 61.5, measuredAt: "2026-10-22T14:00:00+00:00" },
    },
  }));
  await page.reload();
  await expect(page.locator("#run-tests .fail-count")).toHaveText("2 fail");
  await expect(page.locator("#e2e-metrics .fail-count")).toHaveText("1 fail");
  await expect(page.locator("#run-tests .fail-count")).toHaveCSS("color", "rgb(232, 76, 61)");
});

test("specs list the tests that verify them", { tag: ["@tests", "@documentation-reader"] }, async ({ page }) => {
  await page.route("**/api/metrics", (route) => route.fulfill({
    json: {
      tests: 44,
      failures: 0,
      coverage: 75.5,
      measuredAt: "2026-10-22T15:00:00+00:00",
      running: false,
      e2e: { tests: 11, failures: 0, coverage: 75, measuredAt: "2026-10-22T15:00:00+00:00" },
      requirements: {
        "entries-and-writing": {
          unit: ["StoreTests.test_author_defaults_normalizes_and_has_a_limit"],
          e2e: ["entry content renders as Markdown"],
        },
      },
    },
  }));
  await page.goto("/#/docs/specs/entries-and-writing");
  await expect(page.locator(".doc-tests")).toContainText("Automated tests");
  await expect(page.locator(".doc-tests li")).toHaveCount(2);
  await expect(page.locator(".doc-tests ol li")).toHaveCount(2);
  await expect(page.locator(".doc-test-kind")).toHaveCount(2);
  await expect(page.locator(".doc-tests")).toContainText("E2E · 1");
  await expect(page.locator(".doc-tests")).not.toContainText("Last run:");
  await expect(page.locator(".doc-tests")).toContainText("author defaults normalizes and has a limit");
  await expect(page.locator(".doc-tests")).toContainText("entry content renders as Markdown");
});

test("the unit button runs the suite once", { tag: ["@tests"] }, async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/");
  await expect(page.locator("#run-tests")).toHaveText("unit not measured — run");
  await page.locator("#run-tests").click();
  await expect(page.locator("#run-tests")).toHaveText(/unit \d+ · [\d.]+ %/, { timeout: 120_000 });
  await expect(page.locator("#run-tests")).toHaveAttribute("aria-disabled", "true");

  await page.reload();
  await expect(page.locator("#run-tests")).toHaveText(/unit \d+ · [\d.]+ %/);
  const before = await page.locator("#run-tests").textContent();
  await page.locator("#run-tests").evaluate((node) => node.click());
  await page.waitForTimeout(500);
  await expect(page.locator("#run-tests")).toHaveText(before);
});

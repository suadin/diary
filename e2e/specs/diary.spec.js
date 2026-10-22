const { test, expect } = require("@playwright/test");
const { startCoverage, stopCoverage } = require("./coverage");

test("a journey through days, entries, documents, and the guide", { tag: ["@entries-and-writing", "@navigation-and-deep-links", "@documentation-reader", "@writing-guide"] }, async ({ page }) => {
  const measured = await startCoverage(page);
  try {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Entries");
    await expect(page).toHaveURL(/#\/day\/2026-10-22$/);
    await expect(page.locator(".entry-card")).toHaveCount(5);
    await expect(page.locator("#entry-range")).toHaveText("1–5 / 7");

    await page.locator("#entries-older").click();
    await expect(page.locator(".entry-card")).toHaveCount(2);
    await expect(page.locator("#entry-range")).toHaveText("6–7 / 7");

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

    await page.locator(".doc-tab", { hasText: "Requirements" }).click();
    await expect(page.locator("#docs-title")).toHaveText("Requirements");
    await expect(page).toHaveURL(/#\/docs\/requirements\/overview$/);

    await page.goto("/#/guide");
    await page.locator("#skill-editor").fill("# Changed\n");
    await page.locator("#save-skill").click();
    await expect(page.locator("#save-status")).toContainText("Guide saved");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#guide-reset").click();
    await expect(page.locator("#skill-editor")).toHaveValue(/# AI diary writing guide/);
    await expect(page.locator("#save-status")).toContainText("Guide reset");

    await page.locator("#back-to-journal").click();
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
  await page.locator("#search-input").fill("Deep links");
  await expect(page.locator(".result-card p")).not.toContainText("**");
  await page.locator(".result-card").click();
  await expect(page.locator("#entry-view strong").first()).toHaveText("icons");
  await expect(page.locator("#entry-view ul li")).toHaveCount(2);
  await expect(page.locator("#entry-view h4")).toHaveText("Detail");
  await expect(page.locator("#entry-view code")).toContainText("ROUTE.docs");
  await expect(page.locator("#entry-view")).not.toContainText("**");
});

test("documentation wraps bullets, follows links, and fits the page", { tag: ["@documentation-reader"] }, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/#/docs/readme/what-it-does");
  await expect(page.locator("#doc-body li").first()).toContainText("previous or next window");
  const fits = await page.locator("#doc-body").evaluate(
    (node) => node.getBoundingClientRect().bottom <= window.innerHeight,
  );
  expect(fits).toBe(true);

  await page.goto("/#/docs/readme/tests-and-coverage");
  await page.locator('a[data-doc-link="requirements#tests"]').click();
  await expect(page).toHaveURL(/#\/docs\/requirements\/tests$/);
  await expect(page.locator("#doc-section-title")).toHaveText("Tests");

  await page.goto("/#/docs/requirements/overview");
  await page.locator('a[data-doc-link="readme#overview"]').first().click();
  await expect(page).toHaveURL(/#\/docs\/readme\/overview$/);
});

test("requirements sections use distinct icons", { tag: ["@documentation-reader", "@style-and-vocabulary"] }, async ({ page }) => {
  await page.goto("/#/docs/requirements");
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
      running: false,
      e2e: { tests: 12, failures: 0, coverage: 61.5, measuredAt: "2026-10-22T14:00:00+00:00" },
    },
  }));
  await page.goto("/");
  await expect(page.locator("#e2e-metrics")).toHaveText("e2e 12 · 0 fail · 61.5 %");
  await expect(page.locator(".footer-sep")).toHaveCount(3);

  const boxes = await page.locator(".footer-items > *").evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return rect.top + rect.height / 2;
  }));
  expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(3);
});

test("requirements list the tests that verify them", { tag: ["@tests", "@documentation-reader"] }, async ({ page }) => {
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
  await page.goto("/#/docs/requirements/entries-and-writing");
  await expect(page.locator(".doc-tests")).toContainText("Automated tests");
  await expect(page.locator(".doc-tests li")).toHaveCount(2);
  await expect(page.locator(".doc-tests")).toContainText("StoreTests.test_author_defaults_normalizes_and_has_a_limit");
  await expect(page.locator(".doc-tests")).toContainText("entry content renders as Markdown");
});

test("the unit button runs the suite once", { tag: ["@tests"] }, async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/");
  await expect(page.locator("#run-tests")).toHaveText("unit not measured — run");
  await page.locator("#run-tests").click();
  await expect(page.locator("#run-tests")).toHaveText(/unit \d+ · \d+ fail · [\d.]+ %/, { timeout: 120_000 });
  await expect(page.locator("#run-tests")).toHaveAttribute("aria-disabled", "true");

  await page.reload();
  await expect(page.locator("#run-tests")).toHaveText(/unit \d+ · \d+ fail · [\d.]+ %/);
  const before = await page.locator("#run-tests").textContent();
  await page.locator("#run-tests").evaluate((node) => node.click());
  await page.waitForTimeout(500);
  await expect(page.locator("#run-tests")).toHaveText(before);
});

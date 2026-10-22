const fs = require("fs");
const path = require("path");

const coverageFile = process.env.DIARY_E2E_COVERAGE
  || path.join(__dirname, "..", ".coverage.json");

async function startCoverage(page) {
  if (!page.coverage) return false;
  await page.coverage.startJSCoverage({ resetOnNavigation: true });
  return true;
}

function countLines(functions, source) {
  const ranges = [];
  for (const entry of functions) {
    for (const range of entry.ranges) {
      ranges.push(range);
    }
  }
  ranges.sort((left, right) => left.startOffset - right.startOffset || right.endOffset - left.endOffset);

  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }

  let covered = 0;
  let total = 0;
  for (let line = 0; line < starts.length; line += 1) {
    const from = starts[line];
    const to = line + 1 < starts.length ? starts[line + 1] : source.length;
    const text = source.slice(from, to);
    if (!text.trim()) continue;
    if (/^\s*(\/\/|\/\*|\*)/.test(text)) continue;
    total += 1;
    const offset = from + (text.length - text.trimStart().length);
    let count = 0;
    for (const range of ranges) {
      if (offset >= range.startOffset && offset < range.endOffset) count = range.count;
    }
    if (count > 0) covered += 1;
  }
  return {
    coveredLines: covered,
    totalLines: total,
    percent: total ? Math.round((covered / total) * 1000) / 10 : 0,
  };
}

async function stopCoverage(page, enabled) {
  if (!enabled || !page.coverage) return;
  const entries = await page.coverage.stopJSCoverage();
  const script = entries.find((entry) => entry.url.endsWith("/app.js"));
  const result = script
    ? countLines(script.functions, fs.readFileSync(path.join(__dirname, "..", "..", "web", "app.js"), "utf8"))
    : { coveredLines: 0, totalLines: 0, percent: 0 };
  fs.writeFileSync(coverageFile, `${JSON.stringify(result, null, 2)}\n`);
}

module.exports = { startCoverage, stopCoverage };

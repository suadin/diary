const fs = require("fs");
const path = require("path");

class MetricsReporter {
  constructor(options = {}) {
    this.output = options.outputFile
      || process.env.DIARY_E2E_METRICS
      || path.join(__dirname, "test-metrics.e2e.json");
    this.coverageFile = process.env.DIARY_E2E_COVERAGE
      || path.join(__dirname, ".coverage.json");
    this.statuses = [];
  }

  onBegin() {
    try {
      fs.unlinkSync(this.coverageFile);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  onTestEnd(test, result) {
    this.statuses.push(result.status);
  }

  onEnd(result) {
    const failures = this.statuses.filter(
      (status) => status !== "passed" && status !== "skipped",
    ).length;
    let coverage = null;
    try {
      coverage = JSON.parse(fs.readFileSync(this.coverageFile, "utf8"));
    } catch (error) {
      coverage = null;
    }
    const payload = {
      tests: this.statuses.length,
      failures,
      coveredLines: coverage ? coverage.coveredLines : 0,
      totalLines: coverage ? coverage.totalLines : 0,
      coverage: coverage ? coverage.percent : 0,
      measuredAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.dirname(this.output), { recursive: true });
    fs.writeFileSync(this.output, `${JSON.stringify(payload, null, 2)}\n`);
  }
}

module.exports = MetricsReporter;

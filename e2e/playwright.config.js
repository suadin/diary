const path = require("path");
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./specs",
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], [path.join(__dirname, "reporter.js"), {}]],
  use: {
    baseURL: "http://127.0.0.1:8126",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bash ./start.sh",
    cwd: __dirname,
    url: "http://127.0.0.1:8126/api/metrics",
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      DIARY_E2E_DATA: "/tmp/diary-e2e/data",
      DIARY_E2E_CONFIG: "/tmp/diary-e2e/config",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// The test process reads the keys from .env.local the same way Next.js does; Clerk's testing helper needs them to let a
// test browser past its bot protection. The agent never reads that file (deny rule in .claude/settings.json).
loadEnvConfig(process.cwd());

const PORT = 3001;

/** End-to-end tests against the dev server: a real browser, real Clerk sign-in, the real Supabase database (step 7). */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

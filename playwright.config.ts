import { defineConfig } from "@playwright/test";
import { testDatabaseUrl } from "./tests/test-env";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, locale: "th-TH" },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DATABASE_URL: testDatabaseUrl(),
      AUTH_SECRET: "test-secret-not-for-production",
      AUTH_TRUST_HOST: "true",
    },
  },
});

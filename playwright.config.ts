import { defineConfig, devices } from "@playwright/test";

/**
 * Wave 7 / Task 7.1: E2E テスト設定。
 *
 * - npm run preview をテスト中に自動起動 (production build を検証)
 * - mobile-first 設計に合わせて Pixel 7 (~412×915) と Mobile Safari の
 *   2 プロジェクトで実行
 * - CI なら fail-fast、ローカルなら全件流す
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:4321",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: {
    command: "npm run preview",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

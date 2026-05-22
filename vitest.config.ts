import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // tests/e2e/ は Playwright で実行するので Vitest からは除外する
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**"],
  },
});

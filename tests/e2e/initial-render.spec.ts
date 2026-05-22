import { test, expect } from "@playwright/test";

test.describe("Initial render", () => {
  test("front face shows profile name and links", async ({ page }) => {
    await page.goto("/");

    // 表面のプロフィール要素
    await expect(page.getByRole("heading", { name: "庄司 彬人" })).toBeVisible();
    await expect(page.getByText("Akito Shoji")).toBeVisible();

    // GitHub の SVG アイコンリンク (aria-label に github URL を含む)
    const githubLink = page.getByRole("link", { name: /github\.com\/torifo/ });
    await expect(githubLink).toBeVisible();
  });

  test("body has either light-mode or night-mode class on load", async ({
    page,
  }) => {
    await page.goto("/");
    // theme-init.inline.ts が defer module として走り、どちらかが付与されるはず
    await expect(page.locator("body")).toHaveClass(/(light|night)-mode/);
  });

  test("back face is inert before any tab interaction", async ({ page }) => {
    await page.goto("/");
    const back = page.locator("#card-face-back");
    await expect(back).toHaveAttribute("inert", "");
    await expect(back).toHaveAttribute("aria-hidden", "true");
  });

  test("page works without any visible theme toggle UI", async ({ page }) => {
    await page.goto("/");
    // FR-010: 手動切替 UI は存在しないこと
    await expect(page.locator('[data-theme-toggle]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /auto|light|dark/i })).toHaveCount(0);
  });
});

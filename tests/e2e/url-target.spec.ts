import { test, expect } from "@playwright/test";

test.describe("URL ?target= parameter", () => {
  test("?target=go flips to back, filters by Go, and cleans the URL", async ({
    page,
  }) => {
    await page.goto("/?target=go");

    // 裏面が active = card に is-flipped が付く
    await expect(page.locator("#card")).toHaveClass(/is-flipped/);

    // FR-005: URL から ?target= が消えて / になる
    await expect(page).toHaveURL("/");

    // dropdown が Skill > Language > Go の経路に設定される
    await expect(page.locator("#filter-category")).toHaveValue("skill");
    await expect(page.locator("#filter-subcategory")).toHaveValue("language");
    await expect(page.locator("#filter-tag")).toHaveValue("go");

    // Go タグの repo は表示、それ以外は .is-hidden になる
    const visibleCards = page.locator(".repo-card:not(.is-hidden)");
    const hiddenCards = page.locator(".repo-card.is-hidden");
    await expect(visibleCards).not.toHaveCount(0);
    await expect(hiddenCards).not.toHaveCount(0);
  });

  test("?target=golang resolves via alias to the same Go leaf", async ({
    page,
  }) => {
    await page.goto("/?target=golang");
    await expect(page).toHaveURL("/");
    await expect(page.locator("#filter-tag")).toHaveValue("go");
  });

  test("?target=invalid falls back to All on the back face", async ({ page }) => {
    await page.goto("/?target=this-tag-does-not-exist");

    // 裏面表示 + URL クリーンアップは継続
    await expect(page.locator("#card")).toHaveClass(/is-flipped/);
    await expect(page).toHaveURL("/");

    // フィルタは適用されず全 repo が見える
    const hiddenCards = page.locator(".repo-card.is-hidden");
    await expect(hiddenCards).toHaveCount(0);
  });

  test("no ?target= keeps the front face active", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#card")).not.toHaveClass(/is-flipped/);
  });
});

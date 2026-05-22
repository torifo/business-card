import { test, expect } from "@playwright/test";

test.describe("Offline behavior (US-003 / NFR Offline)", () => {
  test("filtering still works after going offline", async ({ page, context }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Back" }).click();

    // 初期 load 完了後はネットワークを切断
    await context.setOffline(true);

    // dropdown を弄ってもクラス操作だけで動くはず
    await page.locator("#filter-category").selectOption("skill");
    await page.locator("#filter-subcategory").selectOption("language");
    await page.locator("#filter-tag").selectOption("go");

    const hiddenCards = page.locator(".repo-card.is-hidden");
    await expect(hiddenCards).not.toHaveCount(0);

    await context.setOffline(false);
  });

  test("flip still works after going offline", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);

    await page.getByRole("tab", { name: "Back" }).click();
    await expect(page.locator("#card")).toHaveClass(/is-flipped/);

    await page.getByRole("tab", { name: "Front" }).click();
    await expect(page.locator("#card")).not.toHaveClass(/is-flipped/);

    await context.setOffline(false);
  });
});

import { test, expect } from "@playwright/test";

test.describe("Tab flip and dropdown filter", () => {
  test("clicking Back flips the card and swaps inert state", async ({ page }) => {
    await page.goto("/");

    const backTab = page.getByRole("tab", { name: "Back" });
    await backTab.click();

    // フリップ反映を待つ (transition 600ms)
    await expect(page.locator("#card")).toHaveClass(/is-flipped/);
    await expect(backTab).toHaveAttribute("aria-selected", "true");

    // 表面が inert に、裏面から inert が外れる
    await expect(page.locator("#card-face-front")).toHaveAttribute("inert", "");
    await expect(page.locator("#card-face-back")).not.toHaveAttribute("inert", "");
  });

  test("clicking Front flips back and restores inert state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Back" }).click();
    await expect(page.locator("#card")).toHaveClass(/is-flipped/);

    await page.getByRole("tab", { name: "Front" }).click();
    await expect(page.locator("#card")).not.toHaveClass(/is-flipped/);
    await expect(page.locator("#card-face-back")).toHaveAttribute("inert", "");
    await expect(page.locator("#card-face-front")).not.toHaveAttribute("inert", "");
  });

  test("dropdown cascade populates subcategory then tag and filters cards", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Back" }).click();

    // Category: skill を選択 → subcategory が enabled になる
    await page.locator("#filter-category").selectOption("skill");
    await expect(page.locator("#filter-subcategory")).toBeEnabled();

    // Subcategory: language を選択 → tag が enabled になる
    await page.locator("#filter-subcategory").selectOption("language");
    await expect(page.locator("#filter-tag")).toBeEnabled();

    // Tag に Go が含まれている
    const goOption = page.locator("#filter-tag option[value='go']");
    await expect(goOption).toHaveCount(1);

    // Tag: go を選択 → Go タグの repo のみ表示
    await page.locator("#filter-tag").selectOption("go");
    const hiddenCards = page.locator(".repo-card.is-hidden");
    await expect(hiddenCards).not.toHaveCount(0);
  });

  test("setting Tag back to All clears the filter", async ({ page }) => {
    await page.goto("/?target=go");
    await expect(page.locator(".repo-card.is-hidden")).not.toHaveCount(0);

    await page.locator("#filter-tag").selectOption("");
    await expect(page.locator(".repo-card.is-hidden")).toHaveCount(0);
  });
});

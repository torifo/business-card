import { test, expect } from "@playwright/test";

test.describe("prefers-reduced-motion (NFR Accessibility)", () => {
  test.use({ reducedMotion: "reduce" });

  test("flip transition uses opacity crossfade instead of 3D rotation", async ({
    page,
  }) => {
    await page.goto("/");

    // 反映前: 3D 回転は使わないので card に rotation が掛かっていない
    // ブラウザによっては "none" ではなく identity matrix を返すので両方許容する
    const isNoRotation = (t: string) =>
      t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)";

    const cardTransformBefore = await page.locator("#card").evaluate(
      (el) => getComputedStyle(el).transform,
    );
    expect(isNoRotation(cardTransformBefore)).toBe(true);

    await page.getByRole("tab", { name: "Back" }).click();
    await expect(page.locator("#card")).toHaveClass(/is-flipped/);

    // 反映後も rotation は掛からない (回転無効化、クロスフェードに置換)
    const cardTransformAfter = await page.locator("#card").evaluate(
      (el) => getComputedStyle(el).transform,
    );
    expect(isNoRotation(cardTransformAfter)).toBe(true);

    // 裏面の opacity が 1 になる (クロスフェード適用)
    const backOpacity = await page.locator("#card-face-back").evaluate(
      (el) => getComputedStyle(el).opacity,
    );
    expect(parseFloat(backOpacity)).toBeGreaterThan(0.9);
  });
});

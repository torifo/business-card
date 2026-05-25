/**
 * 全画面名刺モードの切替。
 *
 * - Fullscreen API 対応ブラウザでは card-stage を requestFullscreen で
 *   ブラウザ chrome ごと隠した本物の全画面にする
 * - 非対応 (古い iOS Safari 等) では .is-fullscreen クラスを付けて
 *   CSS のみで viewport いっぱいの "見た目だけ全画面" にフォールバック
 * - ESC キーで Fullscreen API が解除されたら .is-fullscreen も外す
 */
const button = document.querySelector<HTMLButtonElement>(
  "[data-fullscreen-toggle]",
);
const stage = document.querySelector<HTMLElement>(".card-stage");

if (button && stage) {
  const supportsFullscreenApi = typeof stage.requestFullscreen === "function";

  button.addEventListener("click", async () => {
    try {
      if (supportsFullscreenApi) {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await stage.requestFullscreen();
        }
      } else {
        // フォールバック: CSS クラスのみで全画面風に
        stage.classList.toggle("is-fullscreen");
      }
    } catch (e) {
      console.warn("[fullscreen] toggle failed:", e);
    }
  });

  // Fullscreen API 経由で ESC 等で解除された場合は .is-fullscreen も整える
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      stage.classList.remove("is-fullscreen");
    }
  });
}

/**
 * カードのタブクリックで表/裏をフリップする (Task 6.3 / FR-003)。
 *
 * - [data-face="front" | "back"] ボタンのクリックを購読
 * - クリックされた面に応じて .card に is-flipped を付け外し
 * - TabSwitcher の aria-selected / .is-active を同期
 * - 3D 回転 (600ms) と prefers-reduced-motion 時のクロスフェード (300ms) は
 *   src/styles/card.css 側で完結する。本スクリプトは class の付替に専念する。
 */
const card = document.getElementById("card");
const tabs = document.querySelectorAll<HTMLButtonElement>("[data-face]");

if (card && tabs.length > 0) {
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const targetFace = tab.dataset.face === "back" ? "back" : "front";
      const shouldFlip = targetFace === "back";

      card.classList.toggle("is-flipped", shouldFlip);
      syncTabState(targetFace);
    });
  }
}

function syncTabState(activeFace: "front" | "back"): void {
  for (const tab of tabs) {
    const isActive = tab.dataset.face === activeFace;
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    tab.classList.toggle("is-active", isActive);
  }
}

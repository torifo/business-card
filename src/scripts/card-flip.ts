/**
 * カードのタブクリックで表/裏をフリップする (Task 6.3 / FR-003)。
 *
 * - [data-face="front" | "back"] ボタンのクリックを購読
 * - クリックされた面に応じて .card に is-flipped を付け外し
 * - TabSwitcher の aria-selected / .is-active を同期
 * - 3D 回転 (600ms) と prefers-reduced-motion 時のクロスフェード (300ms) は
 *   src/styles/card.css 側で完結する。本スクリプトは class の付替に専念する。
 *
 * card-filter.ts (Task 6.4) など他のモジュールからプログラム的にフリップを
 * 行えるよう `flipTo` を export する。
 */
export function flipTo(face: "front" | "back"): void {
  const card = document.getElementById("card");
  if (!card) return;
  card.classList.toggle("is-flipped", face === "back");
  syncFaceFocusability(face);
  syncTabState(face);
}

/**
 * 非アクティブ側の面を inert + aria-hidden にし、Tab フォーカスや AT を
 * アクティブな面に閉じ込める。aria-hidden-focus a11y 警告を解消する。
 */
function syncFaceFocusability(activeFace: "front" | "back"): void {
  const front = document.getElementById("card-face-front");
  const back = document.getElementById("card-face-back");
  setInert(front, activeFace !== "front");
  setInert(back, activeFace !== "back");
}

function setInert(el: HTMLElement | null, inert: boolean): void {
  if (!el) return;
  if (inert) {
    el.setAttribute("inert", "");
    el.setAttribute("aria-hidden", "true");
  } else {
    el.removeAttribute("inert");
    el.removeAttribute("aria-hidden");
  }
}

function syncTabState(activeFace: "front" | "back"): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>("[data-face]");
  for (const tab of tabs) {
    const isActive = tab.dataset.face === activeFace;
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    tab.classList.toggle("is-active", isActive);
  }
}

// 起動時にタブクリック → フリップを配線
const tabs = document.querySelectorAll<HTMLButtonElement>("[data-face]");
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    const targetFace = tab.dataset.face === "back" ? "back" : "front";
    flipTo(targetFace);
  });
}
